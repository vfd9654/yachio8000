function trackAudioVolume(audioId, callback) {
    const audio = document.getElementById(audioId);
    if (!audio) {
        console.error(`未找到 ID 为 ${audioId} 的音频元素`);
        return;
    }
    // 1. 初始化 Web Audio API 上下文
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    // 2. 创建音频源和分析器
    const source = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; 
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    // 3. 连接音频节点
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    // 4. 浏览器安全策略：必须在用户交互后才能启动音频上下文
    const startTracking = () => {
        audioCtx.resume().then(() => {
            console.log("音频上下文已启动");
            updateVolume();
        });
    };
    audio.addEventListener('play', () => {
        if (audioCtx.state === 'suspended') {
            startTracking();
        } else {
            updateVolume();
        }
    });
    // 添加用户交互启动（处理自动播放策略）
    document.body.addEventListener('click', () => {
        if (audioCtx.state === 'suspended' && !audio.paused) {
            startTracking();
        }
    }, { once: true });
    // 5. 循环获取音量
    function updateVolume() {
        if (audio.paused || audio.ended) {
            // 音频暂停时发送0值
            callback(0);
            return;
        }
        // 获取当前的时域数据
        analyser.getByteTimeDomainData(dataArray);
        // 计算均方根（RMS）
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
            const value = (dataArray[i] - 128) / 128;
            total += value * value;
        }
        const rms = Math.sqrt(total / bufferLength);
        // 调整灵敏度 - 根据实际需要调整
        let volumePercentage = Math.min(1, rms * 2.0);
        volumePercentage = Math.max(0, volumePercentage);
        // 应用缓动效果使嘴巴运动更平滑
        if (window.lastVolume) {
            volumePercentage = volumePercentage * 0.7 + window.lastVolume * 0.3;
        }
        window.lastVolume = volumePercentage;
        // 保留两位小数
        volumePercentage = parseFloat(volumePercentage.toFixed(2));
        // 通过回调函数将实时百分比传出
        callback(volumePercentage);
        // 持续下一帧的检测
        requestAnimationFrame(updateVolume);
    }
}


var yachio;
var cursor;
(async () => {
    // init PIXI
    const app = new PIXI.Application({
        view: document.getElementById("live2d-canvas"),
        autoStart: true,
        resizeTo: document.body,
    });
    // background
    const bg = PIXI.Sprite.from("https://vfd9654.github.io/yachio8000/front/back.png");
    bg.width = app.screen.width;
    bg.height = app.screen.height;
    app.stage.addChild(bg);
    // yachio init
    yachio = await PIXI.live2d.Live2DModel.from("https://vfd9654.github.io/yachio8000/front/models/yachio/八千代辉夜姬.model3.json");
    app.stage.addChild(yachio);
    yachio.scale.set(0.13);
    yachio.y = app.screen.height / 6;
    yachio.x = (app.screen.width / 2) - (yachio.width / 2);
    yachio.interactive = false;
    // 等待模型加载完成后开始音频追踪
    console.log("Live2D模型已加载");
    // 启动音频音量追踪，连接张嘴参数
    trackAudioVolume('vocal', (volume) => {
        if (yachio && yachio.internalModel && yachio.internalModel.coreModel) {
            // 设置张嘴参数，volume范围0-1
            yachio.internalModel.coreModel.setParameterValueById("ParamMouthOpenY", volume);
        }
    });
})();

window.addEventListener("DOMContentLoaded", function () {
document.body.addEventListener("click", function () {
    const audioElements = document.getElementsByTagName("audio");
    if (audioElements.length > 0) {
        const audio = audioElements[0];
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    }
});
});