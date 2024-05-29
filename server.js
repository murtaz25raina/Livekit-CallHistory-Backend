import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = createServer(app);
// const io = new SocketIOServer(httpServer);


const io = new SocketIOServer(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    // Add other CORS options as needed
  }
});
import { AccessToken, RoomServiceClient, Room } from 'livekit-server-sdk';


const livekitHost = 'http://127.0.0.1:7880';
// const livekitHost = 'wss://test-app-ev2paxwn.livekit.cloud'
const roomService = new RoomServiceClient(livekitHost, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);




dotenv.config({ path: './development.env' });


const createToken = async (roomName, participantName) => {
  // if this room doesn't exist, it'll be automatically created when the first
  // client joins

  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: participantName,
    // token to expire after 10 minutes
    ttl: '10m',
  });
  at.addGrant({ roomJoin: true, room: roomName,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,

   });

  return await at.toJwt();
}


// Enable CORS for all requests


const port = 3001;

app.get('/getToken', async (req, res) => {
  const { roomName, participantName } = req.query;
  // console.log(roomName, participantName);
  res.send(await createToken(roomName, participantName));
});


app.get('/getParticipants', async (req, res) => {
  const { roomName } = req.query;
  // console.log(roomName)
  const data = await roomService.listParticipants(roomName);
  res.send({info:'success',data: data});
});

app.get('/getParticipant',async (req, res) => {
  const { roomName,identity } = req.query;
  const response = await roomService.  getParticipant(roomName, identity);
  res.send({info:'success',data: response});
})


app.get('/muteParticipant', async (req, res) => {
  const { roomName,identity } = req.query;
  await roomService.mutePublishedTrack(roomName, identity, 'track_sid', true);
  res.send({info:'muted'});
});


app.get('/removeParticipant', async (req, res) => {
  const { roomName,identity } = req.query;
  await roomService.removeParticipant(roomName, identity);
  res.send({info:`${identity} removed`});
});




app.get('/createRoom', async (req, res) => {
  const { roomName, participantNumber } = req.query;
  // console.log(roomName, participantNumber);
  const participantNumberInteger = parseInt(participantNumber)
  const opts = {
    name: roomName,
    emptyTimeout: 10 * 60, // 10 minutes
    maxParticipants: participantNumberInteger,
  };
  roomService.createRoom(opts).then((room) => {
    // roomService.listRooms().then((rooms) => {
    //   console.log('existing rooms', rooms);
     
    // });
    res.send({info:'Room created',room: room});
  });
  
  
});

app.get('/roomDetails', async (req, res) => {
  
  roomService.listRooms().then((rooms) => {
    res.send({info:'Room created',rooms});
  });
})


app.get('/roomAvailable', async (req, res) => {
  const { roomName } = req.query;
  let roomsAvailable = []
    roomService.listRooms().then((rooms) => {
      // console.log(rooms);
      roomsAvailable =  [...rooms];
      const roomFound = roomsAvailable.find(obj => obj.name === roomName);
     if(roomFound){
       res.send({info:'Room available',room: roomFound});
     }
     else{
       res.send({info:'Room not available'});
     }
    });
  });



///////////////////////////////////////////////////////////////////////



io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('call', async(currentRoomId,userName,members,callType,callDetail) => {
    // Broadcast to other clients that a new user has joined
    // console.log(members)
    
    // console.log(currentRoomId,userName,membersToCall,callType)
    socket.broadcast.emit('userCalling',currentRoomId,userName,members,callType,callDetail);
  });

  socket.on('acceptCall', async(userName,userWhoIsCalling,roomName,callType,callDetail) => {
    // Broadcast to other clients that a new user has joined
    // const data = await roomService.listParticipants(roomName);

    socket.broadcast.emit('userAccepted',userName,userWhoIsCalling,roomName,callType,callDetail);
  });

  socket.on('leaveCall', async(userName,members,roomName,callDetail) => {
    // Broadcast to other clients that a new user has joined
    const memberOnCallCurrently = await roomService.listParticipants(roomName);
    let mOCallCur = []
    if(memberOnCallCurrently){
      memberOnCallCurrently.forEach((member) => {
        mOCallCur.push(member.identity);
      })
    }
    // console.log(mOCallCur)
    socket.broadcast.emit('userLeft',userName,members,roomName,callDetail,mOCallCur);
  });

  socket.on('rejectCall', async(userName,userWhoIsCalling,roomName,members,callDetail) => {
    // Broadcast to other clients that a new user has joined
    // let membersToCall = [];
    // // console.log("ok",members);
    // if(members){
    //   members.forEach((member) => {
    //     // console.log(member)
    //     if(member.name !== userWhoIsCalling){
    //       membersToCall.push(member.name);
    //     }
    //   })
    // }
    socket.broadcast.emit('userRejected',userName,userWhoIsCalling,roomName,members,callDetail);
  });

  socket.on('cancelCall', async(userName,members,roomName) => {
    // Broadcast to other clients that a new user has joined

    // let membersToCall = [];
    // // console.log("ok",members);
    // if(members){
    //   members.forEach((member) => {
    //     // console.log(member)
    //     if(member.name !== userName){
    //       membersToCall.push(member.name);
    //     }
    //   })
    // }

    socket.broadcast.emit('userCancelled',userName,members,roomName);
  });


  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});




///////////////////////////////////////////////////////////////////////
  



httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})