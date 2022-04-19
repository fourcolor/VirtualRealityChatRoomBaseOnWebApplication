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
      <div className="map">
        <Map getJoints = {getJoints}/>
      </div>
      <CameraView className = "float" mapJoints={mapJoints} />
    </div>
  );
};
export default Chat;
