// server.js
import express from 'express';
import dotenv from 'dotenv';
import { AccessToken, RoomServiceClient, Room } from 'livekit-server-sdk';


const livekitHost = 'http://127.0.0.1:7880';
// const livekitHost = 'wss://test-app-ev2paxwn.livekit.cloud'
const roomService = new RoomServiceClient(livekitHost, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);

import cors from 'cors';

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

const app = express();
// Enable CORS for all requests
app.use(cors());

const port = 3000;

app.get('/getToken', async (req, res) => {
  const { roomName, participantName } = req.query;
  console.log(roomName, participantName);
  res.send(await createToken(roomName, participantName));
});


app.get('/getParticipants', async (req, res) => {
  const { roomName } = req.query;
  console.log(roomName)
  const data = await roomService.listParticipants(roomName);
  res.send({info:'success',data: data});
});


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
  console.log(roomName, participantNumber);
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


app.get('/roomAvailable', async (req, res) => {
  const { roomName } = req.query;
  let roomsAvailable = []
    roomService.listRooms().then((rooms) => {
      console.log(rooms);
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
  



app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})