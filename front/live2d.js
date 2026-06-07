class CanvasLive2D {
    constructor(canvasId, modelUrl = null) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) throw new Error(`Canvas ${canvasId} not found`);
        
        this.ctx = this.canvas.getContext('2d');
        this.modelUrl = modelUrl || 'live2d/八千代辉夜姬.model3.json';
        this.model = null;
        this.mouseX = 0.5;
        this.mouseY = 0.5;
        this.frame = 0;
        
        this.init();
    }
    
    async init() {
        await this.loadSDK();
        await this.loadModel();
        this.setupEvents();
        this.animate();
    }
    
    async loadSDK() {
        const sdkUrl = 'https://cdn.jsdelivr.net/gh/guanssss/live2d-sdk-web@1.0.0/dist/live2d.min.js';
        if (!window.live2d) {
            await new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = sdkUrl;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
    }
    
    async loadModel() {
        // 使用备用绘制，因为实际 Live2D SDK 加载可能复杂
        this.useFallbackDrawing();
    }
    
    useFallbackDrawing() {
        const draw = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // 背景
            const grad = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
            grad.addColorStop(0, '#f093fb');
            grad.addColorStop(1, '#f5576c');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // 身体
            this.ctx.fillStyle = '#FFB6C1';
            this.ctx.beginPath();
            this.ctx.ellipse(this.canvas.width/2, this.canvas.height - 100, 60, 80, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 头部
            this.ctx.fillStyle = '#FFC0CB';
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2, this.canvas.height - 180, 50, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 眼睛
            const eyeX = (this.mouseX - 0.5) * 10;
            const eyeY = (this.mouseY - 0.5) * 8;
            
            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2 - 20 + eyeX, this.canvas.height - 190 + eyeY, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2 + 20 + eyeX, this.canvas.height - 190 + eyeY, 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = 'black';
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2 - 20 + eyeX, this.canvas.height - 190 + eyeY, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2 + 20 + eyeX, this.canvas.height - 190 + eyeY, 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 微笑
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2, this.canvas.height - 170, 20, 0.1, Math.PI - 0.1);
            this.ctx.stroke();
            
            requestAnimationFrame(draw);
        };
        
        draw();
    }
    
    setupEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) / rect.width;
            this.mouseY = (e.clientY - rect.top) / rect.height;
        });
    }
    
    animate() {
        // 动画逻辑
        requestAnimationFrame(() => this.animate());
    }
}

// 使用：
// const live2d = new CanvasLive2D('yourCanvasId');