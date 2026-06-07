/**
 * 纯 JS 加载并渲染 Live2D 模型
 * @param {string} elementId - 容器的 ID（自动在该容器内创建 canvas）
 * @param {string} modelUrl - Live2D 模型的 model.json 绝对或相对路径
 */
function initLive2DModel(elementId, modelUrl) {
    // 1. 动态引入 Live2D 核心依赖库（Cubism Web Framework 基础）
    // 这里使用 cdnjs 提供的 pixi.js 和 pixi-live2d-display 库，这是目前前端最方便渲染 Live2D 的组合
    const scripts = [
        'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js',
        'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js'
    ];

    let loadedCount = 0;

    // 循环加载依赖脚本
    scripts.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            loadedCount++;
            if (loadedCount === scripts.length) {
                // 依赖加载完成后，开始渲染模型
                startRender(elementId, modelUrl);
            }
        };
        document.head.appendChild(script);
    });
}

// 内部核心渲染函数
function startRender(elementId, modelUrl) {
    const container = document.getElementById(elementId);
    if (!container) {
        console.error(`未找到 ID 为 "${elementId}" 的容器元素。`);
        return;
    }

    // 2. 动态创建 Canvas 画布并设置样式
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // 3. 初始化 PIXI 应用
    const app = new PIXI.Application({
        view: canvas,
        autoStart: true,
        resizeTo: container, // 自动撑满容器
        backgroundAlpha: 0   // 背景透明
    });

    // 4. 载入并渲染 Live2D 模型
    // pixi-live2d-display 会自动判断是 Live2D v2(Cubism 2) 还是 v3/v4(Cubism 3/4)
    PIXI.live2d.Live2DModel.from(modelUrl).then(model => {
        // 将模型添加到舞台
        app.stage.addChild(model);

        // 自动适配模型大小和位置
        const scaleX = container.clientWidth / model.width;
        const scaleY = container.clientHeight / model.height;
        
        // 保持比例缩放
        const scale = Math.min(scaleX, scaleY);
        model.scale.set(scale);

        // 居中显示
        model.x = (container.clientWidth - model.width * scale) / 2;
        model.y = (container.clientHeight - model.height * scale) / 2;

        // 绑定互动事件（例如点击、拖拽视线跟随鼠标）
        model.on('hit', (hitAreas) => {
            if (hitAreas.includes('body')) {
                model.motion('tap_body'); // 触发点击身体的动作
            }
        });
    }).catch(error => {
        console.error('Live2D 模型加载失败:', error);
    });
}