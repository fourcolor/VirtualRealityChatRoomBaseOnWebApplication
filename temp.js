import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree, Object3D } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { VRM, VRMSchema, VRMUtils } from "@pixiv/three-vrm";
import { useControls } from "leva";
import { Vector3, Quaternion, Euler, Vector2 } from "three";
import { faceSolver } from "../../../utils/faceSolver";
import { handSolver } from "../../../utils/handSolver";
import {PoseSolver,HandSolver,FaceSolver} from "kalidokit"
// import * as tf from "@tensorflow/tfjs";
// import * as poseDetection from "@tensorflow-models/pose-detection";
// import { Face, Pose, Hand } from "kalidokit";
// import Webcam from "react-webcam";
const confident = 0.3;

const findAngle = (ax, ay, bx, by) => {
  let dy = by - ay;
  let dx = bx - ax;
  return Math.atan2(dy, dx);
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
    // console.log({ v1: v1, v2: v2, dot: d });
  }
  return normalizeAngle(res);
};
const clamp = (val, min, max) => {
  return Math.max(Math.min(val, max), min);
};

const remap = (val, min, max) => {
  //returns min to max -> 0 to 1
  return (clamp(val, min, max) - min) / (max - min);
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

const hipsSolver = (pose2d, pose3d) => {
  const hipLeft2d = new Vector2(pose2d[23].x, pose2d[23].y);
  const hipRight2d = new Vector2(pose2d[24].x, pose2d[24].y);
  const shoulderLeft2d = new Vector2(pose2d[11].x, pose2d[11].y);
  const shoulderRight2d = new Vector2(pose2d[12].x, pose2d[12].y);
  let tp = hipLeft2d;
  const hipCenter2d = tp.lerp(hipRight2d, 1);
  tp = shoulderLeft2d;
  const shoulderCenter2d = tp.lerp(shoulderRight2d, 1);
  const spineLength = hipCenter2d.distanceTo(shoulderCenter2d);
  const hips = {
    position: {
      x: Math.max(Math.min(hipCenter2d.x - 0.4, 1) - 1),
      y: 0,
      z: Math.max(Math.min(spineLength - 1, 0), -2),
    },
  };
  hips.worldPosition = {
    x: hips.position.x,
    y: 0,
    z: hips.position.z * Math.pow(hips.position.z * -2, 2),
  };
  hips.worldPosition.x *= hips.worldPosition.z;
  hips.rotation = new Vector3(
    normalizeAngle(
      findAngle(pose3d[23].z, pose3d[23].x, pose3d[24].z, pose3d[24].x)
    ),
    normalizeAngle(
      findAngle(pose3d[23].z, pose3d[23].y, pose3d[24].z, pose3d[24].y)
    ),
    normalizeAngle(
      findAngle(pose3d[23].x, pose3d[23].y, pose3d[24].x, pose3d[24].y)
    )
  );
  if (hips.rotation.y > 0.5) {
    hips.rotation.y -= 2;
  }
  hips.rotation.y += 0.5;
  if (hips.rotation.z > 0) {
    hips.rotation.z = 1 - hips.rotation.z;
  }
  if (hips.rotation.z < 0) {
    hips.rotation.z = -1 - hips.rotation.z;
  }
  const turnAroundAmountHips = remap(Math.abs(hips.rotation.y), 0.2, 0.4);
  hips.rotation.z *= 1 - turnAroundAmountHips;
  hips.rotation.x = 0;
  const spine = new Vector3(
    normalizeAngle(
      findAngle(pose3d[11].z, pose3d[11].x, pose3d[12].z, pose3d[12].x)
    ),
    normalizeAngle(
      findAngle(pose3d[11].z, pose3d[11].y, pose3d[12].z, pose3d[12].y)
    ),
    normalizeAngle(
      findAngle(pose3d[11].x, pose3d[11].y, pose3d[12].x, pose3d[12].y)
    )
  );
  if (spine.y > 0.5) {
    spine.y -= 2;
  }
  spine.y += 0.5;
  if (spine.z > 0) {
    spine.z = 1 - spine.z;
  }
  if (spine.z < 0) {
    spine.z = -1 - spine.z;
  }
  const turnAroundAmount = remap(Math.abs(spine.y), 0.2, 0.4);
  spine.z *= 1 - turnAroundAmount;
  spine.x = 0;
  if (hips.rotation) {
    hips.rotation.x *= Math.PI;
    hips.rotation.y *= Math.PI;
    hips.rotation.z *= Math.PI;
  }
  spine.x *= Math.PI;
  spine.y *= Math.PI;
  spine.z *= Math.PI;
  return {
    Hips: hips,
    Spine: spine,
  };
};

const armSolver = (poseKeypoints) => {
  let p1 = poseKeypoints[11];
  let p2 = poseKeypoints[13];
  let p3 = poseKeypoints[12];
  let p4 = poseKeypoints[14];
  const UpperArm = {
    r: new Vector3(
      normalizeAngle(findAngle(p1.z, p1.x, p2.z, p2.x)),
      normalizeAngle(findAngle(p1.z, p1.y, p2.z, p2.y)),
      normalizeAngle(findAngle(p1.x, p1.y, p2.x, p2.y))
    ),
    l: new Vector3(
      normalizeAngle(findAngle(p3.z, p3.x, p4.z, p4.x)),
      normalizeAngle(findAngle(p3.z, p3.y, p4.z, p4.y)),
      normalizeAngle(findAngle(p3.x, p3.y, p4.x, p4.y))
    ),
  };
  UpperArm.r.y = find3DCoordsAngle(
    poseKeypoints[12],
    poseKeypoints[11],
    poseKeypoints[13]
  );
  UpperArm.l.y = find3DCoordsAngle(
    poseKeypoints[11],
    poseKeypoints[12],
    poseKeypoints[14]
  );
  p1 = poseKeypoints[13];
  p2 = poseKeypoints[15];
  p3 = poseKeypoints[14];
  p4 = poseKeypoints[16];
  const LowerArm = {
    r: new Vector3(
      normalizeAngle(findAngle(p1.z, p1.x, p2.z, p2.x)),
      normalizeAngle(findAngle(p1.z, p1.y, p2.z, p2.y)),
      normalizeAngle(findAngle(p1.x, p1.y, p2.x, p2.y))
    ),
    l: new Vector3(
      normalizeAngle(findAngle(p3.z, p3.x, p4.z, p4.x)),
      normalizeAngle(findAngle(p3.z, p3.y, p4.z, p4.y)),
      normalizeAngle(findAngle(p3.x, p3.y, p4.x, p4.y))
    ),
  };
  LowerArm.r.y = find3DCoordsAngle(
    poseKeypoints[11],
    poseKeypoints[13],
    poseKeypoints[15]
  );
  LowerArm.l.y = find3DCoordsAngle(
    poseKeypoints[12],
    poseKeypoints[14],
    poseKeypoints[16]
  );
  LowerArm.r.z = Math.max(Math.min(LowerArm.r.z, 0), -2.14);
  LowerArm.l.z = Math.max(Math.min(LowerArm.l.z, 0), -2.14);
  p1 = poseKeypoints[15];
  let ta = new Vector3(
    poseKeypoints[17].x,
    poseKeypoints[17].y,
    poseKeypoints[17].z
  );
  let tb = new Vector3(
    poseKeypoints[19].x,
    poseKeypoints[19].y,
    poseKeypoints[19].z
  );
  p2 = ta.lerp(tb, 0.5);
  p3 = poseKeypoints[16];
  ta = new Vector3(
    poseKeypoints[18].x,
    poseKeypoints[18].y,
    poseKeypoints[18].z
  );
  tb = new Vector3(
    poseKeypoints[20].x,
    poseKeypoints[20].y,
    poseKeypoints[20].z
  );
  p4 = ta.lerp(tb, 0.5);
  const Hand = {
    r: new Vector3(
      normalizeAngle(findAngle(p1.z, p1.x, p2.z, p2.x)),
      normalizeAngle(findAngle(p1.z, p1.y, p2.z, p2.y)),
      normalizeAngle(findAngle(p1.x, p1.y, p2.x, p2.y))
    ),
    l: new Vector3(
      normalizeAngle(findAngle(p3.z, p3.x, p4.z, p4.x)),
      normalizeAngle(findAngle(p3.z, p3.y, p4.z, p4.y)),
      normalizeAngle(findAngle(p3.x, p3.y, p4.x, p4.y))
    ),
  };
  const rightArmRig = rigArm(UpperArm.r, LowerArm.r, Hand.r, 1);
  const leftArmRig = rigArm(UpperArm.l, LowerArm.l, Hand.l, -1);
  return {
    UpperArm: {
      r: rightArmRig.UpperArm,
      l: leftArmRig.UpperArm,
    },
    LowerArm: {
      r: rightArmRig.LowerArm,
      l: leftArmRig.LowerArm,
    },
    Hand: {
      r: rightArmRig.Hand,
      l: leftArmRig.Hand,
    },
  };
};

const rigArm = (UpperArm, LowerArm, Hand, side = 1) => {
  // Invert modifier based on left vs right side
  const invert = side;
  UpperArm.z *= -2.3 * invert;
  //Modify UpperArm rotationY  by LowerArm X and Z rotations
  UpperArm.y *= Math.PI * invert;
  UpperArm.y -= Math.max(LowerArm.x);
  UpperArm.y -= -invert * Math.max(LowerArm.z, 0);
  UpperArm.x -= 0.3 * invert;
  LowerArm.z *= -2.14 * invert;
  LowerArm.y *= 2.14 * invert;
  LowerArm.x *= 2.14 * invert;
  //Clamp values to human limits
  UpperArm.x = Math.max(Math.min(UpperArm.x, Math.PI), -0.5);
  LowerArm.x = Math.max(Math.min(LowerArm.x, 0.3), -0.3);
  Hand.y = Math.max(Math.min(Hand.z * 2, 0.6), -0.6); //side to side
  Hand.z = Hand.z * -2.3 * invert; //up down
  return {
    //Returns Values in Radians for direct 3D usage
    UpperArm: UpperArm,
    LowerArm: LowerArm,
    Hand: Hand,
  };
};
const rigRotation = (rotation = { x: 0, y: 0, z: 0 }, f = 1) => {
  let euler = new Euler(rotation.x * f, rotation.y * f, rotation.z * f);
  let quaternion = new Quaternion().setFromEuler(euler);
  return quaternion;
};
const NBox = ({ position, args }) => {
  const mesh = useRef(null);
  useFrame(() => (mesh.current.rotation.x = mesh.current.rotation.y += 0.01));
  return (
    <mesh ref={mesh} position={position}>
      <boxBufferGeometry attach="geometry" args={args} />
      <meshStandardMaterial attach="material" color="lightblue" />
    </mesh>
  );
};
const Avatar = (props) => {
  const { scene, camera } = useThree();
  // const gltf = useGLTF(
  //   "https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm?v=1630342336981"
  // );
  const gltf = useGLTF("../../../../three-vrm-girl.vrm");
  // const gltf = useGLTF("../../../../model.glb");
  const avatar = useRef();
  const [bonesStore, setBones] = useState({});

  useEffect(() => {
    if (gltf) {
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      VRM.from(gltf).then((vrm) => {
        avatar.current = vrm;
        vrm.lookAt.target = camera;
        vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).rotation.y =
          Math.PI;

        const bones = {
          neck: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Neck),
          hips: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips),
          chest: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Chest),
          spine: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Spine),
          LeftUpperArm: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftUpperArm
          ),
          RightUpperArm: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightUpperArm
          ),
          LeftLowerArm: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftLowerArm
          ),
          RightLowerArm: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightLowerArm
          ),
          LeftHand: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftHand
          ),
          RightHand: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightHand
          ),
          LeftRingProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftRingProximal
          ),
          LeftRingIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftRingIntermediate
          ),
          LeftRingDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftRingDistal
          ),
          LeftIndexProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftIndexProximal
          ),
          LeftIndexIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftIndexIntermediate
          ),
          LeftIndexDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftIndexDistal
          ),
          LeftMiddleProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftMiddleProximal
          ),
          LeftMiddleIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftMiddleIntermediate
          ),
          LeftMiddleDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftMiddleDistal
          ),
          LeftThumbProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftThumbProximal
          ),
          LeftThumbIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftThumbIntermediate
          ),
          LeftThumbDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftThumbDistal
          ),
          LeftLittleProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftLittleProximal
          ),
          LeftLittleIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftLittleIntermediate
          ),
          LeftLittleDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.LeftLittleDistal
          ),

          RightRingProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightRingProximal
          ),
          RightRingIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightRingIntermediate
          ),
          RightRingDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightRingDistal
          ),
          RightIndexProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightIndexProximal
          ),
          RightIndexIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightIndexIntermediate
          ),
          RightIndexDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightIndexDistal
          ),
          RightMiddleProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightMiddleProximal
          ),
          RightMiddleIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightMiddleIntermediate
          ),
          RightMiddleDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightMiddleDistal
          ),
          RightThumbProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightThumbProximal
          ),
          RightThumbIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightThumbIntermediate
          ),
          RightThumbDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightThumbDistal
          ),
          RightLittleProximal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightLittleProximal
          ),
          RightLittleIntermediate: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightLittleIntermediate
          ),
          RightLittleDistal: vrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName.RightLittleDistal
          ),
        };

        setBones(bones);
      });
    }
  }, [scene, gltf, camera]);

  useFrame((state, delta) => {
    const keypoint = props.keypoint();
    // console.log(bonesStore);
    if (keypoint && keypoint.pose && keypoint.face && keypoint.hand) {
      const lm2d = keypoint.pose.p2d;
      const lm3d = keypoint.pose.p3d;
      const facelm = keypoint.face;
      const rHandlm = keypoint.hand.right;
      const lHandlm = keypoint.hand.left;
      if (avatar.current) {
        avatar.current.update(delta);
      }
      let hipAngle = hipsSolver(lm2d, lm3d);
      let NeckAngle = faceSolver(facelm);
      let ArmAngle = armSolver(lm3d);
      let rHandAngle = {},
        lHandAngle = {};
      if (rHandlm) {
        rHandAngle = handSolver(rHandlm, "RIGHT");
      }
      if (lHandlm) {
        lHandAngle = handSolver(lHandlm, "LEFT");
      }
      let _a, _b, _c, _d;

      //DETECT OFFSCREEN AND RESET VALUES TO DEFAULTS
      const rightHandOffscreen =
        lm3d[15].y > 0.1 ||
        ((_a = lm3d[15].score) !== null && _a !== void 0 ? _a : 0) < 0.23 ||
        0.995 < lm2d[15].y;
      const leftHandOffscreen =
        lm3d[16].y > 0.1 ||
        ((_b = lm3d[16].score) !== null && _b !== void 0 ? _b : 0) < 0.23 ||
        0.995 < lm2d[16].y;
      // const leftFootOffscreen =
      //   lm3d[23].y > 0.1 ||
      //   ((_c = lm3d[23].score) !== null && _c !== void 0 ? _c : 0) < 0.63 ||
      //   hipAngle.Hips.position.z > -0.4;
      // const rightFootOffscreen =
      //   lm3d[24].y > 0.1 ||
      //   ((_d = lm3d[24].score) !== null && _d !== void 0 ? _d : 0) < 0.63 ||
      //   hipAngle.Hips.position.z > -0.4;
      //console.log(keypoint);
      ArmAngle.UpperArm.l = ArmAngle.UpperArm.l.multiply(
        leftHandOffscreen ? new Vector3(0, 0, 0) : new Vector3(1, 1, 1)
      );
      //console.log(ArmAngle.UpperArm.l);
      ArmAngle.UpperArm.l.z = leftHandOffscreen ? 1.25 : ArmAngle.UpperArm.l.z;
      ArmAngle.UpperArm.r = ArmAngle.UpperArm.r.multiply(
        rightHandOffscreen ? new Vector3(0, 0, 0) : new Vector3(1, 1, 1)
      );
      ArmAngle.UpperArm.r.z = rightHandOffscreen
        ? -1.25
        : ArmAngle.UpperArm.r.z;
      ArmAngle.LowerArm.l = ArmAngle.LowerArm.l.multiply(
        leftHandOffscreen ? new Vector3(0, 0, 0) : new Vector3(1, 1, 1)
      );
      ArmAngle.LowerArm.r = ArmAngle.LowerArm.r.multiply(
        rightHandOffscreen ? new Vector3(0, 0, 0) : new Vector3(1, 1, 1)
      );
      ArmAngle.Hand.l = ArmAngle.Hand.l.multiply(
        leftHandOffscreen ? new Vector3(0, 0, 0) : new Vector3(1, 1, 1)
      );
      ArmAngle.Hand.r = ArmAngle.Hand.r.multiply(
        rightHandOffscreen ? new Vector3(0, 0, 0) : new Vector3(1, 1, 1)
      );

      if (bonesStore.neck) {
        if (
          keypoint.pose.p3d[8].score > confident &&
          keypoint.pose.p3d[7].score > confident
        ) {
          //console.log(Neckangle);
          let euler = new Euler(NeckAngle.x, NeckAngle.y, NeckAngle.z);
          let quaternion = new Quaternion().setFromEuler(euler);
          bonesStore.neck.quaternion.slerp(quaternion, 0.7);
        }
      }

      if (bonesStore.LeftHand && lHandAngle.LeftWrist) {
        //console.log(Neckangle);
        let euler = new Euler(
          lHandAngle.LeftWrist.x,
          lHandAngle.LeftWrist.y,
          ArmAngle.LeftHand.z
        );
        let quaternion = new Quaternion().setFromEuler(euler);
        bonesStore.neck.quaternion.slerp(quaternion, 0.7);
      }
      if (bonesStore.RightHand && lHandAngle.RightWrist) {
        //console.log(Neckangle);
        let euler = new Euler(
          lHandAngle.RightWrist.x,
          lHandAngle.RightWrist.y,
          ArmAngle.RightHand.z
        );
        let quaternion = new Quaternion().setFromEuler(euler);
        bonesStore.neck.quaternion.slerp(quaternion, 0.7);
      }

      if (bonesStore.hips) {
        let quaternion = rigRotation(hipAngle.Hips.rotation, 0.25);
        bonesStore.hips.quaternion.slerp(quaternion, 0.3);
        let v = new Vector3(
          -hipAngle.Hips.position.x,
          hipAngle.Hips.position.y + 1,
          -hipAngle.Hips.position.z
        );
        bonesStore.hips.position.lerp(v, 0.07);
      }
      // if (bonesStore.chest) {
      //   let quaternion = rigRotation(hipAngle.Spine, 0.25);
      //   bonesStore.chest.quaternion.slerp(quaternion, 0.3);
      // }
      // if (bonesStore.spine) {
      //   let quaternion = rigRotation(hipAngle.Spine, 0.45);
      //   bonesStore.spine.quaternion.slerp(quaternion, 0.3);
      // }
      const lHandNodeName = [
        "LeftRingProximal",
        "LeftRingIntermediate",
        "LeftRingDistal",
        "LeftIndexProximal",
        "LeftIndexIntermediate",
        "LeftIndexDistal",
        "LeftMiddleProximal",
        "LeftMiddleIntermediate",
        "LeftMiddleDistal",
        "LeftThumbProximal",
        "LeftThumbIntermediate",
        "LeftThumbDistal",
        "LeftLittleProximal",
        "LeftLittleIntermediate",
        "LeftLittleDistal",
      ];
      const rHandNodeName = [
        "RightRingProximal",
        "RightRingIntermediate",
        "RightRingDistal",
        "RightIndexProximal",
        "RightIndexIntermediate",
        "RightIndexDistal",
        "RightMiddleProximal",
        "RightMiddleIntermediate",
        "RightMiddleDistal",
        "RightThumbProximal",
        "RightThumbIntermediate",
        "RightThumbDistal",
        "RightLittleProximal",
        "RightLittleIntermediate",
        "RightLittleDistal",
      ];

      if (bonesStore.LeftUpperArm) {
        let quaternion = rigRotation(ArmAngle.UpperArm.l);
        bonesStore.LeftUpperArm.quaternion.slerp(quaternion, 0.3);
      }
      if (bonesStore.LeftLowerArm) {
        let quaternion = rigRotation(ArmAngle.LowerArm.l);
        bonesStore.LeftLowerArm.quaternion.slerp(quaternion, 0.3);
      }
      if (bonesStore.LeftHand) {
        let quaternion = rigRotation(ArmAngle.Hand.l);
        bonesStore.LeftHand.quaternion.slerp(quaternion, 0.3);
      }

      if (bonesStore.RightUpperArm) {
        let quaternion = rigRotation(ArmAngle.UpperArm.r);
        bonesStore.RightUpperArm.quaternion.slerp(quaternion, 0.3);
      }
      if (bonesStore.RightLowerArm) {
        let quaternion = rigRotation(ArmAngle.LowerArm.r);
        bonesStore.RightLowerArm.quaternion.slerp(quaternion, 0.3);
      }
      if (bonesStore.RightHand) {
        let quaternion = rigRotation(ArmAngle.Hand.r);
        bonesStore.RightHand.quaternion.slerp(quaternion, 0.3);
      }
      // console.log(lHandAngle);
      lHandNodeName.forEach((e) => {
        if (bonesStore[e] && lHandAngle[e]) {
          let quaternion = rigRotation(lHandAngle[e]);
          bonesStore.RightHand.quaternion.slerp(quaternion, 0.3);
        }
      });
      rHandNodeName.forEach((e) => {
        if (bonesStore[e] && rHandAngle[e]) {
          let quaternion = rigRotation(rHandAngle[e]);
          bonesStore.RightHand.quaternion.slerp(quaternion, 0.3);
        }
      });
    }
  });
  return <primitive object={gltf.scene}></primitive>;
};
export default function Map(props) {
  return (
    <Canvas
      className="canvas"
      colorManagement
      camera={{ position: [16, 15, 15], fov: 20 }}
    >
      <OrbitControls />
      <directionalLight intensity={1} position={[-8, 20, 1]} />
      <ambientLight intensity={0.15} />
      {/* <NBox position={[1, 1, 1]} args={[3, 2, 1]} /> */}
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
          <planeBufferGeometry attach="geometry" args={[20, 20]} />
          <meshPhongMaterial attach="material" color="yellow" />
        </mesh>
      </group>
      <Suspense fallback={null}>
        <Avatar keypoint={props.getJoints} />
      </Suspense>
    </Canvas>
  );
}
