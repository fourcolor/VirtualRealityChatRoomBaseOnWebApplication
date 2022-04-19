import { useState, useEffect } from "react";
import "../index.css";
const RoomId = (props) => {
  const [roomId, SetroomId] = useState("");
  const [ws, setWs] = useState(null);
  let roomIdChange = (e) => {
    SetroomId(e.target.value);
  };
  // const connectWebSocket = () => {
  //   setWs(webSocket(process.env.BackendUrl));
  // };
  // useEffect(() => {
  //   if (ws) {
  //     console.log("success connect!");
  //     initWebSocket();
  //   }
  // }, [ws]);
  // const joinRoom = () => {};

  return (
    <div>
      <div>
        <input
          className="input"
          type="text"
          value={roomId}
          onChange={roomIdChange}
        />
      </div>
      <div>
        <button  className="button">
          Join Room
        </button>
      </div>
      <div>
        <button className="button">Create Room</button>
      </div>
    </div>
  );
};
export default RoomId;
