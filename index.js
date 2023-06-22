let localStream;
let remoteStream;
let peerConnection;
let APP_ID="898b2bf7a70b4736b910d48548d2c3ac";
let token=null;
//User Id for each user
let uid=String(Math.floor(Math.random() *10000))

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId) {
    window.location = 'lobby.html'
}

//Client to login with and has access to all the functions
let client;

// What the users join
let channel;


const stun_servers = {
    iceServers:[
        {
            urls:['stun:stun1.1.google.com:19302','stun:stun2.1.google.com:19302']
        }
    ]
}
let constraints={
    video:{
        width:{min:640, ideal:1920, max:1920},
        height:{min:480, ideal:1080, max:1080},
    },
    audio:true
}


let init = async()=>{
    client = await AgoraRTM.createInstance(APP_ID) 
    await client.login({uid, token})

    // Create channel
    channel = client.createChannel(roomId)
    //join channel
    await channel.join()

    // Listen for message from peer
    client.on('MessageFromPeer',handleMessageFromPeer)

    //listen for when a new client joins channel
    channel.on('MemberJoined',handleUserJoined)

    //Listen for when user leaves channel
    channel.on('MemberLeft',handleUserLeft)

    // Create Local Stream
    localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false})
    document.getElementById('user-1').srcObject=localStream
    
}

let handleUserLeft = (MemberId) =>{
    document.getElementById('user-2').style.display='none'
    document.getElementById('user-1').classList.remove('smallFrame')
}

let handleMessageFromPeer = async(message,MemberId)=>{
    message=JSON.parse(message.text)

    if(message.type==='offer'){
        createAnswer(MemberId, message.offer)
    }
    if(message.type==='answer'){
        addAnswer(message.answer)
    }
    if(message.type==='candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }

}

let handleUserJoined = async (MemberId) =>{
    console.log('New User Joined Channel: ',MemberId)
    createOffer(MemberId)
}

let createPeerConnection = async (MemberId) =>{
    peerConnection = new RTCPeerConnection(stun_servers)
    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject=remoteStream
    document.getElementById('user-2').style.display='block'


    document.getElementById('user-1').classList.add('smallFrame')

    // Additional measure to ensure camera is obtained
    if(!localStream){
        // Create Local Stream
        localStream = await navigator.mediaDevices.getUserMedia(constraints)
        document.getElementById('user-1').srcObject=localStream
    }

    // Get all tracks from local stream and add to remote peer
    localStream.getTracks().forEach((track) =>{
        peerConnection.addTrack(track,localStream)
    })

    // Listen for anytime remote peer adds tracks and add to remote stream
    peerConnection.ontrack = (event)=>{
        event.streams[0].getTracks().forEach((track)=>{
            remoteStream.addTrack(track)
        })
    }

    // Generate Ice Candidates
    peerConnection.onicecandidate = async(event) =>{
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':event.candidate})},MemberId)
        }
    }

}

let createOffer = async(MemberId) =>{
    await createPeerConnection(MemberId)
    // Create Offer
    let offer = await peerConnection.createOffer()
    //Set Local Description
    await peerConnection.setLocalDescription(offer)

    //Send Offer to peer
    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId)
}

let createAnswer = async(MemberId,offer) =>{
    await createPeerConnection(MemberId)

    // For the receiving peer, the offer is the remote description and the answer is the local description
    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    //Send answer to peer 1 or peer that sent offer 
    client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId)
}

//Set remote description of peer 1 or peer that sends offer
let addAnswer = async(answer) =>{
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async() =>{
    await channel.leave()
    await client.logout()
}

let toggleCamera = async() =>{
    let videoTrack = localStream.getTracks().find(track => track.kind==='video')

    if(videoTrack.enabled){
        videoTrack.enabled=false
        document.getElementById('camera-btn').style.backgroundColor='rgb(255,80,80)'
    }
    else{
        videoTrack.enabled=true
        document.getElementById('camera-btn').style.backgroundColor='rgba(179,102,249,0.9)'
    }
}

let toggleMic = async() =>{
    let audioTrack = localStream.getTracks().find(track => track.kind==='audio')

    if(audioTrack.enabled){
        audioTrack.enabled=false
        document.getElementById('mic-btn').style.backgroundColor='rgb(255,80,80)'
    }
    else{
        audioTrack.enabled=true
        document.getElementById('mic-btn').style.backgroundColor='rgba(179,102,249,0.9)'
    }
}

window.addEventListener('beforeunload',leaveChannel)
document.getElementById('camera-btn').addEventListener('click',toggleCamera)
document.getElementById('mic-btn').addEventListener('click',toggleMic)
init()