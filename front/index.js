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
    // 设置 FFT（快速傅里叶变换）大小，数值越小响应越快但精度稍低
    analyser.fftSize = 256; 
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    // 3. 连接音频节点
    source.connect(analyser);
    analyser.connect(audioCtx.destination); // 确保声音能正常播放出来
    // 4. 浏览器安全策略：必须在用户交互后才能启动音频上下文
    audio.addEventListener('play', () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        updateVolume();
    });
    // 5. 循环获取音量
    function updateVolume() {
        if (audio.paused || audio.ended) return;
        // 获取当前的时域数据（波形数据）
        analyser.getByteTimeDomainData(dataArray);
        // 计算均方根（RMS），即波形的平均振幅
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
            // 将 0-255 的数据归一化到 -1 到 1 的范围
            const value = (dataArray[i] - 128) / 128;
            total += value * value;
        }
        const rms = Math.sqrt(total / bufferLength);
        // 缩放并限制在 0-1 的百分比范围内（乘以权重系数可根据音频实际情况调整灵敏度）
        let volumePercentage = Math.min(1, rms * 1.5); 
        // 保留两位小数
        volumePercentage = parseFloat(volumePercentage.toFixed(2));
        // 通过回调函数将实时百分比传出
        callback(volumePercentage);
        // 持续下一帧的检测
        requestAnimationFrame(updateVolume);
    }
}
window.addEventListener('DOMContentLoaded', () => {
    trackAudioVolume('vocal', (volume) => {
        if (yachio) {
            yachio.internalModel.coreModel.setParameterValueById("ParamMouthOpenY", volume); // 张嘴
        }
    });
});


var yachio;
var cursor;
(async () => {
    // init
    const app = new PIXI.Application({
        view: document.getElementById("live2d-canvas"),
        autoStart: true,
        resizeTo: document.body,
    });
    // background
    const bg = PIXI.Sprite.from("back.png");
    bg.width = app.screen.width;
    bg.height = app.screen.height;
    app.stage.addChild(bg);
    // yachio init
    yachio = await PIXI.live2d.Live2DModel.from("models/yachio/八千代辉夜姬.model3.json");
    app.stage.addChild(yachio);
    yachio.scale.set(0.13);
    yachio.y = app.screen.height / 6;
    yachio.x = (app.screen.width / 2) - (yachio.width / 2);
    yachio.interactive = false;
})();

document.body.addEventListener("click", function () {
    document.getElementsByTagName("audio").forEach(function (e) {
        e.play();
    })
})