/**
 * Live2D 纯前端免 HTML 渲染插件
 * 支持自动加载依赖、按序初始化、自动居中缩放及鼠标视线追踪
 */
(function (global) {
    'use strict';

    // 定义需要加载的依赖库（严格匹配 PIXI v7 及其兼容版本）
    // 将原来的 DEPENDENCIES 替换为下面这段：
    const DEPENDENCIES = [
        'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js',
        'https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Core/live2dcubismcore.min.js',
        'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.5.0-beta.7/dist/index.min.js'
    ];

    let isLoaded = false;
    let isLoading = false;
    const initQueue = []; // 缓冲队列，防止依赖未加载完时多次调用报错

    /**
     * 串行加载远程脚本
     */
    function loadScripts(urls, callback) {
        let index = 0;

        function next() {
            if (index < urls.length) {
                const script = document.createElement('script');
                script.src = urls[index];
                script.async = false; // 确保执行顺序
                script.onload = () => {
                    index++;
                    next();
                };
                script.onerror = () => {
                    console.error(`[Live2D] 依赖脚本加载失败: ${urls[index]}`);
                };
                document.head.appendChild(script);
            } else {
                callback();
            }
        }
        next();
    }

    /**
     * 核心渲染逻辑
     */
    function render(elementId, modelUrl, options = {}) {
        const container = document.getElementById(elementId);
        if (!container) {
            console.error(`[Live2D] 未找到 ID 为 "${elementId}" 的容器元素。`);
            return;
        }

        // 检查容器定位，确保 canvas 相对定位正确
        const style = window.getComputedStyle(container);
        if (style.position === 'static') {
            container.style.position = 'relative';
        }

        // 动态创建 canvas 元素
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        // 初始化 PIXI Application
        const app = new PIXI.Application({
            view: canvas,
            autoStart: true,
            resizeTo: container,
            backgroundAlpha: 0 // 默认背景透明
        });

        // 载入 Live2D 模型
        PIXI.live2d.Live2DModel.from(modelUrl)
            .then(model => {
                app.stage.addChild(model);

                // 适配缩放比例（默认充满容器的 90%）
                const zoom = options.zoom || 0.9;
                const scaleX = container.clientWidth / model.width;
                const scaleY = container.clientHeight / model.height;
                const scale = Math.min(scaleX, scaleY) * zoom;
                model.scale.set(scale);

                // 居中模型位置
                model.x = (container.clientWidth - model.width * scale) / 2;
                model.y = (container.clientHeight - model.height * scale) / 2;

                // 开启鼠标/指针追踪视线互动
                if (options.trackPointer !== false) {
                    model.trackPointer();
                }

                // 绑定点击互动
                model.on('hit', (hitAreas) => {
                    if (hitAreas.includes('body') || hitAreas.includes('Body')) {
                        model.motion('tap_body'); 
                    } else if (hitAreas.includes('face') || hitAreas.includes('Face')) {
                        model.motion('tap_face');
                    }
                });

                // 暴露给外层，方便微调
                if (typeof options.onSuccess === 'function') {
                    options.onSuccess(model, app);
                }
            })
            .catch(error => {
                console.error('[Live2D] 模型渲染失败:', error);
                if (typeof options.onError === 'function') {
                    options.onError(error);
                }
            });
    }

    /**
     * 暴露给外部的主入口函数
     * @param {string} elementId - 容器ID
     * @param {string} modelUrl - 模型配置文件（.json / .model3.json）的URL
     * @param {Object} [options] - 配置参数
     */
    global.initLive2DModel = function (elementId, modelUrl, options = {}) {
        if (isLoaded) {
            render(elementId, modelUrl, options);
            return;
        }

        // 将当前任务加入队列
        initQueue.push({ elementId, modelUrl, options });

        if (!isLoading) {
            isLoading = true;
            loadScripts(DEPENDENCIES, () => {
                isLoaded = true;
                isLoading = false;
                // 依赖加载完成后，清空并执行队列中的所有渲染任务
                while (initQueue.length > 0) {
                    const task = initQueue.shift();
                    render(task.elementId, task.modelUrl, task.options);
                }
            });
        }
    };

})(window);