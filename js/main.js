function getVideoInputs (info){
    var arr = []
    for (var i = 0 ; i < info.length ; i++ ){
        if (info[i].kind === 'videoinput'){
            arr.push(info[i])
        }
    }
    return arr
}

function printOnScreen(list){
    var main = document.getElementById('main')
    for (var i = 0 ; i < list.length ; i++){
        var div = document.createElement('div')
        var x1 = document.createElement('div');
        var x2 = document.createElement('div');
        var x3 = document.createElement('div');
        var x4 = document.createElement('div');
        var elemList=[x1,x2,x3,x4]
        x1.innerText = `deviceId: ${list[i].deviceId}`
        x2.innerText = `groupId: ${list[i].groupId}`
        x3.innerText = `kind: ${list[i].kind}`
        x4.innerText = `label: ${list[i].label}`
        for (var b = 0 ; b < 4 ; b++){
            div.appendChild(elemList[b])
            main.appendChild(div)
        }
        document.body.appendChild(main)
    }
}


function init(){

    var video = document.querySelector('video');

    navigator.mediaDevices.enumerateDevices()
    .then(ipnutInfo=>getVideoInputs(ipnutInfo))
    .then(inputArr=> printOnScreen(inputArr))
    .catch(err=>console.log(err))
} 

init()
