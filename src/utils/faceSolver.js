import { Vector3, Quaternion, Euler } from "three";
const normalizeAngle = (radians) => {
  let angle = radians % (Math.PI * 2);
  angle =
    angle > Math.PI
      ? angle - Math.PI * 2
      : angle < -Math.PI
      ? Math.PI * 2 + angle
      : angle;
  //returns normalized values to -1,1
  return angle / Math.PI;
};
export const faceSolver = (faceKeypoints) => {
  const v1 = new Vector3(
    faceKeypoints[21][0],
    faceKeypoints[21][1],
    faceKeypoints[21][2]
  );
  const v2 = new Vector3(
    faceKeypoints[251][0],
    faceKeypoints[251][1],
    faceKeypoints[251][2]
  );
  const v3 = new Vector3(
    faceKeypoints[397][0],
    faceKeypoints[397][1],
    faceKeypoints[397][2]
  );
  const v4 = new Vector3(
    faceKeypoints[172][0],
    faceKeypoints[172][1],
    faceKeypoints[172][2]
  );
  const v3mid = v3.lerp(v4, 0.5);
  const qb = v2.sub(v1);
  const qc = v3mid.sub(v1);
  const qbt = qb;
  const n = qbt.cross(qc);
  const unitZ = n.normalize();
  const beta = normalizeAngle(Math.asin(unitZ.x)) || 0;
  const alpha = -normalizeAngle(Math.atan2(-unitZ.y, unitZ.z)) || 0;
  const unitX = qb.normalize();
  const unitY = unitZ.cross(unitX);
  const gamma = normalizeAngle(Math.atan2(-unitY.x, unitX.x)) || 0;
  return new Vector3(alpha * Math.PI, beta * Math.PI, gamma * Math.PI);
};
