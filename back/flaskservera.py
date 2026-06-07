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

class Live2DStreamer:
    def __init__(self, width=854, height=480):  # 480p，平衡画质和网速
        self.width = width
        self.height = height
        self.running = True
        self.model = None
        self.background = None
        self.current_frame = None
        self.frame_lock = threading.Lock()
        
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
        
    def capture_frame(self):
        """捕获帧"""
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
            
            # 质量优化：保留原始分辨率，适中压缩
            _, jpeg = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 75])
            
            with self.frame_lock:
                self.current_frame = jpeg.tobytes()
                
        except Exception as e:
            pass
            
    def run(self):
        """主循环"""
        clock = pygame.time.Clock()
        
        while self.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.running = False
            
            self.capture_frame()
            clock.tick(25)  # 25帧，流畅且节省带宽
            
    def get_frame(self):
        with self.frame_lock:
            return self.current_frame
            
    def cleanup(self):
        self.running = False
        if self.model:
            live2d.dispose()
        pygame.quit()


class VideoStreamHandler(BaseHTTPRequestHandler):
    streamer = None
    
    def do_GET(self):
        if self.path == '/video_feed' or self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            
            try:
                while VideoStreamHandler.streamer.running:
                    frame = VideoStreamHandler.streamer.get_frame()
                    if frame:
                        self.wfile.write(b'--frame\r\n')
                        self.wfile.write(b'Content-Type: image/jpeg\r\n')
                        self.wfile.write(f'Content-Length: {len(frame)}\r\n'.encode())
                        self.wfile.write(b'\r\n')
                        self.wfile.write(frame)
                        self.wfile.write(b'\r\n')
                    else:
                        time.sleep(0.033)
            except:
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
    
    print("初始化 Live2D...")
    streamer = Live2DStreamer(width=1280, height=720)  # 480p
    streamer.init()
    streamer.load_model(MODEL_PATH, BACKGROUND_PATH)
    
    VideoStreamHandler.streamer = streamer
    
    server = HTTPServer(('0.0.0.0', 5000), VideoStreamHandler)
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    local_ip = get_local_ip()
    print("\n" + "="*50)
    print("Live2D 视频流服务已启动")
    print("="*50)
    print(f"分辨率: 854x480 (480p)")
    print(f"帧率: 25 fps")
    print(f"图片质量: 75%")
    print(f"本地访问: http://localhost:5000/video_feed")
    print(f"局域网访问: http://{local_ip}:5000/video_feed")
    print("\n按 Ctrl+C 停止服务")
    print("="*50 + "\n")
    
    try:
        streamer.run()
    except KeyboardInterrupt:
        print("\n正在停止服务...")
    finally:
        server.shutdown()
        streamer.cleanup()
        print("服务已停止")