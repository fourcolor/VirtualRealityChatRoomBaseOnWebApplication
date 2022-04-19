import { Vector3, Quaternion, Euler, Vector2 } from "three";
/** Class representing hand solver. */
const clamp = (val, min, max) => {
  return Math.max(Math.min(val, max), min);
};

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

const find3DCoordsAngle = (a, b, c) => {
  let ta = new Vector3(a.x, a.y, a.z);
  let tb = new Vector3(b.x, b.y, b.z);
  let tc = new Vector3(c.x, c.y, c.z);
  let t = ta;
  const v1 = ta.sub(tb).normalize();
  const v2 = t.sub(tc).normalize();
  let d = v1.dot(v2);
  if (d > 1) {
    d = 1;
  }
  const res = Math.acos(d);
  if (isNaN(res)) {
    console.log({ v1: v1, v2: v2, dot: d });
  }
  return normalizeAngle(res);
};
/**
 * Converts normalized rotation values into radians clamped by human limits
 * @param {Object} hand : object of labeled joint with normalized rotation values
 * @param {Side} side : left or right
 */
const rigFingers = (hand, side = "RIGHT") => {
  // Invert modifier based on left vs right side
  const invert = side === "RIGHT" ? 1 : -1;
  const digits = ["Ring", "Index", "Little", "Thumb", "Middle"];
  const segments = ["Proximal", "Intermediate", "Distal"];
  hand[side + "Wrist"].x = clamp(
    hand[side + "Wrist"].x * 2 * invert,
    -0.3,
    0.3
  ); // twist
  hand[side + "Wrist"].y = clamp(
    hand[side + "Wrist"].y * 2.3,
    side === "RIGHT" ? -1.2 : -0.6,
    side === "RIGHT" ? 0.6 : 1.6
  );
  hand[side + "Wrist"].z = hand[side + "Wrist"].z * -2.3 * invert; //left right
  digits.forEach((e) => {
    segments.forEach((j) => {
      const trackedFinger = hand[side + e + j];
      if (e === "Thumb") {
        //dampen thumb rotation depending on segment
        const dampener = {
          x: j === "Proximal" ? 2.2 : j === "Intermediate" ? 0 : 0,
          y: j === "Proximal" ? 2.2 : j === "Intermediate" ? 0.7 : 1,
          z: j === "Proximal" ? 0.5 : j === "Intermediate" ? 0.5 : 0.5,
        };
        const startPos = {
          x: j === "Proximal" ? 1.2 : j === "Distal" ? -0.2 : -0.2,
          y:
            j === "Proximal"
              ? 1.1 * invert
              : j === "Distal"
              ? 0.1 * invert
              : 0.1 * invert,
          z:
            j === "Proximal"
              ? 0.2 * invert
              : j === "Distal"
              ? 0.2 * invert
              : 0.2 * invert,
        };
        const newThumb = { x: 0, y: 0, z: 0 };
        if (j === "Proximal") {
          newThumb.z = clamp(
            startPos.z + trackedFinger.z * -Math.PI * dampener.z * invert,
            side === "RIGHT" ? -0.6 : -0.3,
            side === "RIGHT" ? 0.3 : 0.6
          );
          newThumb.x = clamp(
            startPos.x + trackedFinger.z * -Math.PI * dampener.x,
            -0.6,
            0.3
          );
          newThumb.y = clamp(
            startPos.y + trackedFinger.z * -Math.PI * dampener.y * invert,
            side === "RIGHT" ? -1 : -0.3,
            side === "RIGHT" ? 0.3 : 1
          );
        } else {
          newThumb.z = clamp(
            startPos.z + trackedFinger.z * -Math.PI * dampener.z * invert,
            -2,
            2
          );
          newThumb.x = clamp(
            startPos.x + trackedFinger.z * -Math.PI * dampener.x,
            -2,
            2
          );
          newThumb.y = clamp(
            startPos.y + trackedFinger.z * -Math.PI * dampener.y * invert,
            -2,
            2
          );
        }
        trackedFinger.x = newThumb.x;
        trackedFinger.y = newThumb.y;
        trackedFinger.z = newThumb.z;
      } else {
        //will document human limits later
        trackedFinger.z = clamp(
          trackedFinger.z * -Math.PI * invert,
          side === "RIGHT" ? -Math.PI : 0,
          side === "RIGHT" ? 0 : Math.PI
        );
      }
    });
  });
  return hand;
};

/**
 * Calculates finger and wrist as euler rotations
 * @param {Array} lm : array of 3D hand vectors from tfjs or mediapipe
 * @param {Side} side: left or right
 */
export const handSolver = (lm, side = "RIGHT") => {
  if (!lm) {
    console.error("Need Hand Landmarks");
    return;
  }
  let index0 = side === "RIGHT" ? 17 : 5;
  let index1 = side === "RIGHT" ? 5 : 17;
  const palm = [
    new Vector3(lm[0].x, lm[0].y, lm[0].z),
    new Vector3(lm[index0].x, lm[index0].y, lm[index0].z),
    new Vector3(lm[index1].x, lm[index1].y, lm[index1].z),
  ];
  let v1 = new Vector3(
    palm[0].x,
    palm[0].y,
    palm[0].z
  );
  let v2 = new Vector3(
    palm[1].x,
    palm[1].y,
    palm[1].z
  );
  let v3 = new Vector3(
    palm[2].x,
    palm[2].y,
    palm[2].z
  );
  const qb = v2.sub(v1);
  const qc = v3.sub(v1);
  const qbt = qb;
  const n = qbt.cross(qc);
  const unitZ = n.normalize();
  const beta = normalizeAngle(Math.asin(unitZ.x)) || 0;
  const alpha = -normalizeAngle(Math.atan2(-unitZ.y, unitZ.z)) || 0;
  const unitX = qb.normalize();
  const unitY = unitZ.cross(unitX);
  const gamma = normalizeAngle(Math.atan2(-unitY.x, unitX.x)) || 0;
  const handRotation = new Vector3(alpha, beta, gamma);
  handRotation.y = handRotation.z;
  handRotation.y -= side === "LEFT" ? 0.4 : 0.4;
  let hand = {};
  hand[side + "Wrist"] = {
    x: handRotation.x,
    y: handRotation.y,
    z: handRotation.z,
  };
  hand[side + "RingProximal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[0], lm[13], lm[14]),
  };
  hand[side + "RingIntermediate"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[13], lm[14], lm[15]),
  };
  hand[side + "RingDistal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[14], lm[15], lm[16]),
  };
  hand[side + "IndexProximal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[0], lm[5], lm[6]),
  };
  hand[side + "IndexIntermediate"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[5], lm[6], lm[7]),
  };
  hand[side + "IndexDistal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[6], lm[7], lm[8]),
  };
  hand[side + "MiddleProximal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[0], lm[9], lm[10]),
  };
  hand[side + "MiddleIntermediate"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[9], lm[10], lm[11]),
  };
  hand[side + "MiddleDistal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[10], lm[11], lm[12]),
  };
  hand[side + "ThumbProximal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[0], lm[1], lm[2]),
  };
  hand[side + "ThumbIntermediate"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[1], lm[2], lm[3]),
  };
  hand[side + "ThumbDistal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[2], lm[3], lm[4]),
  };
  hand[side + "LittleProximal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[0], lm[17], lm[18]),
  };
  hand[side + "LittleIntermediate"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[17], lm[18], lm[19]),
  };
  hand[side + "LittleDistal"] = {
    x: 0,
    y: 0,
    z: find3DCoordsAngle(lm[18], lm[19], lm[20]),
  };
  hand = rigFingers(hand, side);
  return hand;
};
