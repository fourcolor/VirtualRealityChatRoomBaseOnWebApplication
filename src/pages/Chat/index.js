import Map from "./component/Map";
import { Canvas } from "@react-three/fiber";
import CameraView from "./component/CameraView";
const Chat = () => {
  let kp;
  const mapJoints = (keypoints) => {
    kp = keypoints;
  };
  const getJoints = () => {
    return kp;
  };
  return (
    <div className="canvas">

      <span className="map">
        <Map getJoints={getJoints} />
      </span>
      <span>
        <CameraView className="float" mapJoints={mapJoints} />
      </span>
    </div>
  );
};
export default Chat;
