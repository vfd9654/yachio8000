// 纯原生 Live2D Cubism 5 SDK 实现
// 使用官方 Cubism Web Framework

(function() {
    // ==================== 配置 ====================
    // 模型地址（请替换为你自己的模型）
    const MODEL_PATH = "live2d/八千代辉夜姬.model3.json";
    
    // 创建 canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'live2d-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
    
    // 调整 canvas 尺寸
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // ==================== Live2D 核心变量 ====================
    let gl = null;
    let cubismRenderer = null;
    let live2DModel = null;
    let animationId = null;
    let cubismConfig = null;
    
    // ==================== 加载 Cubism SDK ====================
    async function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`加载失败: ${src}`));
            document.head.appendChild(script);
        });
    }
    
    async function loadCubismSDK() {
        console.log('正在加载 Live2D Cubism SDK...');
        
        // 加载 Cubism Core
        await loadScript('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.js');
        console.log('Cubism Core 加载完成');
        
        // 等待 Live2DCubismFramework 可用
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (typeof Live2DCubismFramework !== 'undefined') {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
        
        // 加载 Cubism Framework
        await loadScript('https://cdn.jsdelivr.net/npm/live2d-cubism@5.0.0/lib/live2dcubismframework.js');
        console.log('Cubism Framework 加载完成');
        
        // 等待初始化完成
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ==================== WebGL 初始化 ====================
    function initWebGL() {
        gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
            throw new Error('浏览器不支持 WebGL');
        }
        
        // 设置透明背景和混合模式
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        console.log('WebGL 初始化成功');
    }
    
    // ==================== 加载模型文件 ====================
    async function fetchBuffer(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
        return await response.arrayBuffer();
    }
    
    async function loadModel() {
        const CubismFramework = Live2DCubismFramework;
        const csm = CubismFramework.CubismFramework;
        
        // 创建资源加载器
        const resourceLoader = {
            loadBytes: async (path) => {
                console.log('加载资源:', path);
                const fullUrl = new URL(path, MODEL_URL).href;
                return new Uint8Array(await fetchBuffer(fullUrl));
            }
        };
        
        // 加载 .model3.json
        console.log('加载模型配置:', MODEL_URL);
        const modelJsonBuffer = await fetchBuffer(MODEL_URL);
        const modelSetting = csm.CubismModelSettingJson.create(modelJsonBuffer);
        
        // 创建模型
        live2DModel = csm.CubismModel.loadModel(modelSetting, resourceLoader);
        console.log('模型加载成功');
        
        // 创建渲染器
        cubismRenderer = CubismFramework.CubismRenderer_WebGL.create();
        cubismRenderer.initialize(gl);
        cubismRenderer.setModel(live2DModel);
        
        // 设置透明背景
        cubismRenderer.setClearColor(0.0, 0.0, 0.0, 0.0);
        
        // 设置模型大小和位置
        const modelWidth = live2DModel.getCanvasWidth();
        const modelHeight = live2DModel.getCanvasHeight();
        const screenWidth = canvas.width;
        const screenHeight = canvas.height;
        
        // 计算缩放比例，让模型适配屏幕高度
        const scale = (screenHeight / modelHeight) * 0.7;
        cubismRenderer.setMvpMatrix(
            1.0, 0, 0, 0,
            0, 1.0, 0, 0,
            0, 0, 1.0, 0,
            0, 0, 0, 1.0
        );
        
        // 设置模型位置（底部居中）
        const offsetX = (screenWidth - modelWidth * scale) / 2 / screenWidth * 2;
        const offsetY = -0.3; // 向上偏移
        
        // 更新 MVP 矩阵实现缩放和位移
        const projection = new Float32Array(16);
        projection[0] = scale * 2 / screenWidth * canvas.width;
        projection[5] = scale * 2 / screenHeight * canvas.height;
        projection[10] = 1;
        projection[12] = offsetX;
        projection[13] = offsetY;
        projection[15] = 1;
        
        cubismRenderer.setMvpMatrix(projection);
        
        // 加载运动数据
        try {
            const motionCount = modelSetting.getMotionCount('Idle');
            console.log('发现动作数量:', motionCount);
        } catch(e) {
            console.log('无动作数据');
        }
        
        // 设置鼠标交互
        setupInteraction();
    }
    
    // ==================== 鼠标交互 ====================
    function setupInteraction() {
        canvas.addEventListener('click', (e) => {
            // 点击时触发 tap 动作
            if (live2DModel && live2DModel.getParameterIndex) {
                try {
                    // 触发身体点击参数
                    const paramIndex = live2DModel.getParameterIndex('ParamTapBody');
                    if (paramIndex >= 0) {
                        live2DModel.addParameterValue(paramIndex, 1.0);
                    }
                    console.log('点击模型');
                    
                    // 简单动画反馈
                    let scale = 0.7;
                    const animate = setInterval(() => {
                        scale += 0.05;
                        if (scale > 0.75) clearInterval(animate);
                    }, 20);
                } catch(e) {}
            }
        });
        
        // 鼠标移动时让模型视线跟随
        let lastX = 0, lastY = 0;
        canvas.addEventListener('mousemove', (e) => {
            if (!live2DModel) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            // 更新眼球参数
            try {
                const eyeX = live2DModel.getParameterIndex('ParamEyeBallX');
                const eyeY = live2DModel.getParameterIndex('ParamEyeBallY');
                if (eyeX >= 0) live2DModel.setParameterValue(eyeX, (x - 0.5) * 2);
                if (eyeY >= 0) live2DModel.setParameterValue(eyeY, (y - 0.5) * 1.5);
            } catch(e) {}
            
            lastX = x;
            lastY = y;
        });
    }
    
    // ==================== 动画循环 ====================
    function animate() {
        if (!gl || !cubismRenderer || !live2DModel) return;
        
        // 清除画布
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // 更新模型参数（让模型动起来）
        const now = Date.now() / 1000;
        
        // 添加呼吸效果
        try {
            const breathParam = live2DModel.getParameterIndex('ParamBreath');
            if (breathParam >= 0) {
                const breath = Math.sin(now * 2) * 0.5 + 0.5;
                live2DModel.setParameterValue(breathParam, breath);
            }
            
            // 添加眨眼
            const eyeLOpen = live2DModel.getParameterIndex('ParamEyeLOpen');
            const eyeROpen = live2DModel.getParameterIndex('ParamEyeROpen');
            if (eyeLOpen >= 0 && eyeROpen >= 0) {
                const blink = Math.sin(now * 4) > 0.95 ? 0 : 1;
                live2DModel.setParameterValue(eyeLOpen, blink);
                live2DModel.setParameterValue(eyeROpen, blink);
            }
            
            // 身体轻微摆动
            const bodyX = live2DModel.getParameterIndex('ParamBodyX');
            if (bodyX >= 0) {
                live2DModel.setParameterValue(bodyX, Math.sin(now) * 15);
            }
            const bodyY = live2DModel.getParameterIndex('ParamBodyY');
            if (bodyY >= 0) {
                live2DModel.setParameterValue(bodyY, Math.sin(now * 1.2) * 8);
            }
        } catch(e) {}
        
        // 更新模型
        live2DModel.update();
        
        // 渲染
        cubismRenderer.render(live2DModel);
        
        // 继续动画
        animationId = requestAnimationFrame(animate);
    }
    
    // ==================== 主函数 ====================
    async function main() {
        try {
            // 显示加载提示
            showLoadingMessage();
            
            // 加载 SDK
            await loadCubismSDK();
            
            // 初始化 WebGL
            initWebGL();
            
            // 初始化 Cubism Framework
            const CubismFramework = Live2DCubismFramework;
            CubismFramework.CubismFramework.initialize();
            console.log('Cubism Framework 初始化完成');
            
            // 加载模型
            await loadModel();
            
            // 隐藏加载提示
            hideLoadingMessage();
            
            // 启动动画
            animate();
            
            // 窗口大小改变时重新调整
            window.addEventListener('resize', () => {
                resizeCanvas();
                if (gl) {
                    gl.viewport(0, 0, canvas.width, canvas.height);
                }
            });
            
            console.log('Live2D 启动成功！');
            
        } catch (error) {
            console.error('Live2D 启动失败:', error);
            showErrorMessage(error.message);
        }
    }
    
    // ==================== UI 辅助函数 ====================
    function showLoadingMessage() {
        const div = document.createElement('div');
        div.id = 'live2d-loading';
        div.textContent = '🎀 Live2D 模型加载中... 🎀';
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.left = '20px';
        div.style.backgroundColor = 'rgba(0,0,0,0.7)';
        div.style.color = 'white';
        div.style.padding = '8px 16px';
        div.style.borderRadius = '20px';
        div.style.fontFamily = 'system-ui';
        div.style.fontSize = '14px';
        div.style.zIndex = '10000';
        div.style.backdropFilter = 'blur(8px)';
        document.body.appendChild(div);
    }
    
    function hideLoadingMessage() {
        const div = document.getElementById('live2d-loading');
        if (div) div.remove();
    }
    
    function showErrorMessage(msg) {
        const div = document.createElement('div');
        div.textContent = `❌ Live2D 错误: ${msg}`;
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.left = '20px';
        div.style.backgroundColor = 'rgba(255,0,0,0.7)';
        div.style.color = 'white';
        div.style.padding = '8px 16px';
        div.style.borderRadius = '20px';
        div.style.fontFamily = 'system-ui';
        div.style.fontSize = '12px';
        div.style.zIndex = '10000';
        document.body.appendChild(div);
        
        // 绘制备用画面
        const ctx = canvas.getContext('2d');
        function drawFallback() {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '24px system-ui';
            ctx.fillStyle = '#ccc';
            ctx.textAlign = 'center';
            ctx.fillText('✨ Live2D Ready ✨', canvas.width/2, canvas.height/2);
            ctx.font = '14px system-ui';
            ctx.fillStyle = '#888';
            ctx.fillText('点击页面任意位置', canvas.width/2, canvas.height/2 + 40);
        }
        drawFallback();
        window.addEventListener('resize', drawFallback);
    }
    
    // 启动
    main();
})();