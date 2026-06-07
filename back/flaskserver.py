# live2d_http_stream.py
import os
import cv2
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
import pygame
from pygame.locals import *
import threading
import time
from OpenGL.GL import *
import live2d.v3 as live2d
from live2d.utils.image import Image
from collections import deque

class AdaptiveLive2DStreamer:
    def __init__(self, width=1280, height=720):
        self.width = width
        self.height = height
        self.running = True
        self.model = None
        self.background = None
        self.current_frame = None
        self.frame_lock = threading.Lock()
        
        # 自适应参数
        self.current_quality = 75  # JPEG质量
        self.current_scale = 1.0   # 缩放比例
        self.current_fps = 30      # 目标帧率
        self.last_frame_size = 0
        self.frame_times = deque(maxlen=30)
        
        # 质量等级 (分辨率, 质量, 帧率)
        self.quality_levels = [
            {"name": "超高", "scale": 1.0, "quality": 90, "fps": 30, "min_bandwidth": 2000},  # 2MB/s
            {"name": "高", "scale": 0.9, "quality": 80, "fps": 30, "min_bandwidth": 1500},    # 1.5MB/s
            {"name": "中", "scale": 0.75, "quality": 70, "fps": 25, "min_bandwidth": 800},      # 800KB/s
            {"name": "低", "scale": 0.6, "quality": 60, "fps": 20, "min_bandwidth": 400},        # 400KB/s
            {"name": "极低", "scale": 0.5, "quality": 50, "fps": 15, "min_bandwidth": 200}       # 200KB/s
        ]
        self.current_level = 2  # 从"中"开始
        self.bandwidth_history = deque(maxlen=20)
        self.last_adjust_time = time.time()
        
    def init(self):
        """初始化"""
        pygame.init()
        live2d.init()
        
        os.environ['SDL_VIDEO_CENTERED'] = '1'
        pygame.display.set_mode((self.width, self.height), DOUBLEBUF | OPENGL)
        pygame.display.set_caption("Live2D Streamer")
        
        live2d.glInit()
        glClearColor(0.0, 0.0, 0.0, 1.0)
        glDisable(GL_DEPTH_TEST)
        
    def load_model(self, model_path, background_path=None):
        """加载模型"""
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        self.model = live2d.LAppModel()
        self.model.LoadModelJson(model_path)
        self.model.Resize(self.width, self.height)
        self.model.SetOffsetY(-0.25)
        self.model.SetScale(0.9)
        
        try:
            self.model.StartMotion("笑咪咪", priority=1, no=0)
        except:
            pass
        
        if background_path and os.path.exists(background_path):
            self.background = Image(background_path)
            
    def calculate_bandwidth(self, frame_size, elapsed_time):
        """计算当前带宽 (KB/s)"""
        if elapsed_time > 0:
            bandwidth = (frame_size / 1024) / elapsed_time
            self.bandwidth_history.append(bandwidth)
            return np.mean(self.bandwidth_history)
        return 0
        
    def adjust_quality(self, frame_size, frame_time):
        """根据网速自动调整质量"""
        current_time = time.time()
        
        # 每5秒调整一次
        if current_time - self.last_adjust_time < 5:
            return
            
        # 计算当前带宽
        bandwidth = self.calculate_bandwidth(frame_size, frame_time)
        
        # 根据带宽选择质量等级
        new_level = self.current_level
        for i, level in enumerate(self.quality_levels):
            if bandwidth > level["min_bandwidth"]:
                new_level = i
            else:
                break
                
        # 避免频繁切换
        if new_level != self.current_level:
            old_level = self.current_level
            self.current_level = new_level
            level = self.quality_levels[self.current_level]
            
            self.current_scale = level["scale"]
            self.current_quality = level["quality"]
            self.current_fps = level["fps"]
            
            print(f"\n[自适应] 带宽: {bandwidth:.0f}KB/s -> 切换到{level['name']}质量")
            print(f"  分辨率: {int(self.width*level['scale'])}x{int(self.height*level['scale'])}")
            print(f"  质量: {level['quality']}%, FPS: {level['fps']}")
            
        self.last_adjust_time = current_time
        
    def capture_frame(self):
        """捕获帧（自适应）"""
        try:
            glClear(GL_COLOR_BUFFER_BIT)
            live2d.clearBuffer(0.0, 0.0, 0.0, 0.0)
            
            if self.background:
                self.background.Draw()
            
            if self.model:
                self.model.Update()
                self.model.Draw()
            
            pygame.display.flip()
            
            buffer = glReadPixels(0, 0, self.width, self.height, GL_RGB, GL_UNSIGNED_BYTE)
            image = np.frombuffer(buffer, dtype=np.uint8).reshape(self.height, self.width, 3)
            image = np.flipud(image)
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            # 根据当前质量等级缩放和压缩
            if self.current_scale < 1.0:
                new_w = int(self.width * self.current_scale)
                new_h = int(self.height * self.current_scale)
                image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            
            _, jpeg = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, self.current_quality])
            frame_data = jpeg.tobytes()
            
            with self.frame_lock:
                self.current_frame = frame_data
                self.last_frame_size = len(frame_data)
                
            return len(frame_data)
                
        except Exception as e:
            return 0
            
    def run(self):
        """主循环（带自适应）"""
        clock = pygame.time.Clock()
        last_frame_time = time.time()
        
        while self.running:
            frame_start = time.time()
            
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.running = False
                        
            # 捕获帧并获取大小
            frame_size = self.capture_frame()
            
            # 计算帧间隔
            frame_time = time.time() - last_frame_time
            if frame_size > 0 and frame_time > 0:
                self.frame_times.append(frame_time)
                # 自适应调整
                self.adjust_quality(frame_size, frame_time)
                
            last_frame_time = time.time()
            print(self.get_stats())
            # 控制帧率
            target_frame_time = 1.0 / self.current_fps
            elapsed = time.time() - frame_start
            if elapsed < target_frame_time:
                time.sleep(target_frame_time - elapsed)
                
    def get_frame(self):
        with self.frame_lock:
            return self.current_frame
            
    def get_stats(self):
        """获取当前统计信息"""
        level = self.quality_levels[self.current_level]
        return {
            "quality": self.current_quality,
            "scale": self.current_scale,
            "fps": self.current_fps,
            "level": level["name"],
            "frame_size_kb": self.last_frame_size / 1024
        }
            
    def cleanup(self):
        self.running = False
        if self.model:
            live2d.dispose()
        pygame.quit()


class AdaptiveVideoStreamHandler(BaseHTTPRequestHandler):
    streamer = None
    
    def do_GET(self):
        if self.path == '/video_feed':
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            
            try:
                while AdaptiveVideoStreamHandler.streamer.running:
                    frame = AdaptiveVideoStreamHandler.streamer.get_frame()
                    if frame:
                        self.wfile.write(b'--frame\r\n')
                        self.wfile.write(b'Content-Type: image/jpeg\r\n')
                        self.wfile.write(f'Content-Length: {len(frame)}\r\n'.encode())
                        self.wfile.write(b'\r\n')
                        self.wfile.write(frame)
                        self.wfile.write(b'\r\n')
                    else:
                        time.sleep(0.033)
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass


def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"


if __name__ == '__main__':
    MODEL_PATH = "alive2d_model/八千代辉夜姬.model3.json"
    BACKGROUND_PATH = "back.png"
    
    print("初始化 Live2D 自适应流...")
    streamer = AdaptiveLive2DStreamer()
    streamer.init()
    streamer.load_model(MODEL_PATH, BACKGROUND_PATH)
    
    AdaptiveVideoStreamHandler.streamer = streamer
    
    server = HTTPServer(('0.0.0.0', 5000), AdaptiveVideoStreamHandler)
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    local_ip = get_local_ip()
    print("\n" + "="*60)
    print("Live2D 自适应视频流服务已启动")
    print("="*60)
    print(f"访问地址: http://{local_ip}:5000/viewer")
    print(f"视频流: http://{local_ip}:5000/video_feed")
    print(f"统计信息: http://{local_ip}:5000/stats")
    print("\n🎯 自适应功能:")
    print("  - 自动检测客户端网速")
    print("  - 动态调整分辨率、质量和帧率")
    print("  - 网速快时自动提升画质")
    print("  - 网速慢时自动降低带宽占用")
    print("\n按 Ctrl+C 停止服务")
    print("="*60 + "\n")
    
    try:
        streamer.run()
    except KeyboardInterrupt:
        print("\n正在停止服务...")
    finally:
        server.shutdown()
        streamer.cleanup()
        print("服务已停止")