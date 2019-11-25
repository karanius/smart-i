var program = (function(){
    var model = {
        init:function(){
            console.log('initing the model')
        }
    };
    var x = {
        init:function(){
            model.init()
            view.init()
        }
    };
    var view = {
        init:function(){
            window.intervalId = []
            this.selectHold = document.createElement('div')
            this.videoSelect = document.createElement('select');
            this.videoSelect.id = 'selectVideoSource';
            this.videoElement = document.createElement('video');
            this.videoElement.autoplay = true;
            this.videoElement.poster = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/HAL9000.svg/500px-HAL9000.svg.png';
            this.boundingBox = document.createElement('div');
            this.boundingBox.classList.add('boundingBox');
            this.captureButton = document.createElement('button');
            this.stopButton = document.createElement('button');
            this.captureButton.innerText = "Start" 
            this.stopButton.innerText = "Stop"
            
            this.vidAndBoundBOx = document.createElement('div')
            this.vidAndBoundBOx.classList.add('vidAndBox')

            this.container = document.getElementById('container')

            this.vidAndBoundBOx.appendChild(this.videoElement)
            this.vidAndBoundBOx.appendChild(this.boundingBox)

            this.selectHold.appendChild(this.videoSelect)


            container.appendChild(this.selectHold);
            container.appendChild(this.vidAndBoundBOx)
            container.appendChild(this.captureButton);
            container.appendChild(this.stopButton);
            this.videoSelect.onchange = this.getStream;
            this.videoSource = this.videoSelect.value;
            this.constraints = {
                video: {deviceId: this.videoSource ? {exact: this.videoSource} : undefined}
            };

            this.captureButton.onclick = function(){
                view.getStream()
                .then(function(stream){return view.getDevices(stream)})
                .then(function(devices){view.gotDevices(devices)})
                window.x = view.faceRecog()
                window.x.start()
            }

            this.stopButton.onclick = function(){
                window.stream.getTracks().forEach(function(track){
                        track.stop()
                    })
                window.x.end()
            }
        },
        getStream:function(){
            if (window.stream) {
                window.stream.getTracks().forEach(track => {
                    track.stop();
                });
            }
            return navigator.mediaDevices.getUserMedia(view.constraints)
            .then(function(res){view.gotStream(res)}).catch(view.handleError);
        },

        getDevices: function () {
            return navigator.mediaDevices.enumerateDevices();
        },
        gotDevices: function (deviceInfos) {
            window.deviceInfos = deviceInfos; 
            for (var deviceInfo of deviceInfos) {
                var option = document.createElement('option');
                option.value = deviceInfo.deviceId;
                if (deviceInfo.kind === 'videoinput') {
                    option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
                    view.videoSelect.appendChild(option);
                }
            }
        },
        gotStream:function (stream) {
            window.stream = stream; 
            view.videoSelect.selectedIndex = [...view.videoSelect.options].
            findIndex(option => option.text === stream.getVideoTracks()[0].label);
            view.videoElement.srcObject = stream;
        },
        calculateFaceLocation: async function (data){
            var calrifaiFace = data.outputs[0].data.regions[0].region_info.bounding_box;
            var frame = document.querySelector('video')
            var width = Number(frame.offsetWidth)
            var height = Number(frame.offsetHeight)
            return {
                topRow: calrifaiFace.top_row * height,
                leftCol: calrifaiFace.left_col * width,
                bottomRow: height - (calrifaiFace.bottom_row * height),
                rightCol: width - (calrifaiFace.right_col * width),
            }
        },
        drawBox:function(box){
            this.boundingBox.style.top = (box.topRow + 25 ) +'px';
            this.boundingBox.style.left = (box.leftCol  )+'px';
            this.boundingBox.style.right = (box.rightCol )+'px';
            this.boundingBox.style.bottom = (box.bottomRow + 25)+'px';
        },
        faceRecog: (function(){
            var key = '4ad2aef66b2548fb98f3fe9d3cfd9767'
            var app = new Clarifai.App({apiKey: key})
            var canvas = document.createElement('canvas');
            async function fc(){
                canvas.width = view.videoElement.videoWidth;
                canvas.height = view.videoElement.videoHeight;
                canvas.getContext('2d').drawImage(view.videoElement,0,0)
                var img = canvas.toDataURL('image/base64').slice(22)
                //////////////
                await app.models
                .predict( Clarifai.FACE_DETECT_MODEL  , { base64: img } )
                .then(function(res){
                    return view.calculateFaceLocation(res)
                }).then(
                    function(location){
                        view.drawBox(location)
                    }
                )
                .catch(function(err){console.log(err)});
                /////////////
            }
            function start(){
                var list = window.intervalId;
                this.end()
                var id = setInterval(fc,500);
                list.push(id)
                window.intervalId = list
            };
            function end(){
                window.intervalId.forEach(function(id){
                    clearInterval(id)
                })
            }
            return {
                start:start,
                end:end,
            }
        }),
        handleErrorf:function (error) {
                    console.error('Error: ', error);
        },
    }
    return {
        init:x.init()
    }
})()
program