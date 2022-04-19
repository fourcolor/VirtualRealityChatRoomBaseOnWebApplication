import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree, Object3D } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { VRM, VRMSchema, VRMUtils } from "@pixiv/three-vrm";
import { useControls } from "leva";
import { Vector3, Quaternion, Euler, Vector2 } from "three";
import { faceSolver } from "../../../utils/faceSolver";
import { handSolver } from "../../../utils/handSolver";
import {Vector, Face, Pose, Hand} from "kalidokit"
// import * as tf from "@tensorflow/tfjs";
// import * as poseDetection from "@tensorflow-models/pose-detection";
// import { Face, Pose, Hand } from "kalidokit";
// import Webcam from "react-webcam";
let currentVrm;
const rigRotation = (
  name,
  rotation = { x: 0, y: 0, z: 0 },
  dampener = 1,
  lerpAmount = 0.3
) => {
  if (!currentVrm) {
    return;
  }
  const Part = currentVrm.humanoid.getBoneNode(
    VRMSchema.HumanoidBoneName[name]
  );
  if (!Part) {
    return;
  }

  let euler = new Euler(
    rotation.x * dampener,
    rotation.y * dampener,
    rotation.z * dampener
  );
  let quaternion = new Quaternion().setFromEuler(euler);
  Part.quaternion.slerp(quaternion, lerpAmount); // interpolate
};

const rigPosition = (
  name,
  position = { x: 0, y: 0, z: 0 },
  dampener = 1,
  lerpAmount = 0.3
) => {
  if (!currentVrm) {
    return;
  }
  const Part = currentVrm.humanoid.getBoneNode(
    VRMSchema.HumanoidBoneName[name]
  );
  if (!Part) {
    return;
  }
  let vector = new Vector3(
    position.x * dampener,
    position.y * dampener,
    position.z * dampener
  );
  Part.position.lerp(vector, lerpAmount); // interpolate
};

let oldLookTarget = new Euler();
const rigFace = (riggedFace) => {
  if (!currentVrm) {
    return;
  }
  rigRotation("Neck", riggedFace.head, 0.7);

  // Blendshapes and Preset Name Schema
  const Blendshape = currentVrm.blendShapeProxy;
  const PresetName = VRMSchema.BlendShapePresetName;

  // Simple example without winking. Interpolate based on old blendshape, then stabilize blink with `Kalidokit` helper function.
  // for VRM, 1 is closed, 0 is open.
  riggedFace.eye.l = Vector.lerp(
    Vector.clamp(1 - riggedFace.eye.l, 0, 1),
    Blendshape.getValue(PresetName.Blink),
    0.5
  );
  riggedFace.eye.r = Vector.lerp(
    Vector.clamp(1 - riggedFace.eye.r, 0, 1),
    Blendshape.getValue(PresetName.Blink),
    0.5
  );
  riggedFace.eye = Face.stabilizeBlink(
    riggedFace.eye,
    riggedFace.head.y
  );
  Blendshape.setValue(PresetName.Blink, riggedFace.eye.l);

  // Interpolate and set mouth blendshapes
  Blendshape.setValue(
    PresetName.I,
    Vector.lerp(riggedFace.mouth.shape.I, Blendshape.getValue(PresetName.I), 0.5)
  );
  Blendshape.setValue(
    PresetName.A,
    Vector.lerp(riggedFace.mouth.shape.A, Blendshape.getValue(PresetName.A), 0.5)
  );
  Blendshape.setValue(
    PresetName.E,
    Vector.lerp(riggedFace.mouth.shape.E, Blendshape.getValue(PresetName.E), 0.5)
  );
  Blendshape.setValue(
    PresetName.O,
    Vector.lerp(riggedFace.mouth.shape.O, Blendshape.getValue(PresetName.O), 0.5)
  );
  Blendshape.setValue(
    PresetName.U,
    Vector.lerp(riggedFace.mouth.shape.U, Blendshape.getValue(PresetName.U), 0.5)
  );

  //PUPILS
  //interpolate pupil and keep a copy of the value
  let lookTarget = new Euler(
    Vector.lerp(oldLookTarget.x, riggedFace.pupil.y, 0.4),
    Vector.lerp(oldLookTarget.y, riggedFace.pupil.x, 0.4),
    0,
    "XYZ"
  );
  oldLookTarget.copy(lookTarget);
  currentVrm.lookAt.applyer.lookAt(lookTarget);
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
  console.log(props.keypoint())
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

    const keypoints = props.keypoint();
    const results = keypoints.data;
    let riggedPose, riggedLeftHand, riggedRightHand, riggedFace;

    const faceLandmarks = results.faceLandmarks;
    // Pose 3D Landmarks are with respect to Hip distance in meters
    const pose3DLandmarks = results.ea;
    // Pose 2D landmarks are with respect to videoWidth and videoHeight
    const pose2DLandmarks = results.poseLandmarks;
    // Be careful, hand landmarks may be reversed
    const leftHandLandmarks = results.rightHandLandmarks;
    const rightHandLandmarks = results.leftHandLandmarks;
  
    // Animate Face
    if (faceLandmarks) {
      riggedFace = Face.solve(faceLandmarks, {
        runtime: "mediapipe",
      });
      rigFace(riggedFace);
    }
  
    // Animate Pose
    if (pose2DLandmarks && pose3DLandmarks) {
      riggedPose = Pose.solve(pose3DLandmarks, pose2DLandmarks, {
        runtime: "mediapipe",
      });
      rigRotation("Hips", riggedPose.Hips.rotation, 0.7);
      rigPosition(
        "Hips",
        {
          x: -riggedPose.Hips.position.x, // Reverse direction
          y: riggedPose.Hips.position.y + 1, // Add a bit of height
          z: -riggedPose.Hips.position.z, // Reverse direction
        },
        1,
        0.07
      );
  
      rigRotation("Chest", riggedPose.Spine, 0.25, 0.3);
      rigRotation("Spine", riggedPose.Spine, 0.45, 0.3);
  
      rigRotation("RightUpperArm", riggedPose.RightUpperArm, 1, 0.3);
      rigRotation("RightLowerArm", riggedPose.RightLowerArm, 1, 0.3);
      rigRotation("LeftUpperArm", riggedPose.LeftUpperArm, 1, 0.3);
      rigRotation("LeftLowerArm", riggedPose.LeftLowerArm, 1, 0.3);
  
      rigRotation("LeftUpperLeg", riggedPose.LeftUpperLeg, 1, 0.3);
      rigRotation("LeftLowerLeg", riggedPose.LeftLowerLeg, 1, 0.3);
      rigRotation("RightUpperLeg", riggedPose.RightUpperLeg, 1, 0.3);
      rigRotation("RightLowerLeg", riggedPose.RightLowerLeg, 1, 0.3);
    }
  
    // Animate Hands
    if (leftHandLandmarks) {
      riggedLeftHand = Hand.solve(leftHandLandmarks, "Left");
      rigRotation("LeftHand", {
        // Combine pose rotation Z and hand rotation X Y
        z: riggedPose.LeftHand.z,
        y: riggedLeftHand.LeftWrist.y,
        x: riggedLeftHand.LeftWrist.x,
      });
      rigRotation("LeftRingProximal", riggedLeftHand.LeftRingProximal);
      rigRotation("LeftRingIntermediate", riggedLeftHand.LeftRingIntermediate);
      rigRotation("LeftRingDistal", riggedLeftHand.LeftRingDistal);
      rigRotation("LeftIndexProximal", riggedLeftHand.LeftIndexProximal);
      rigRotation("LeftIndexIntermediate", riggedLeftHand.LeftIndexIntermediate);
      rigRotation("LeftIndexDistal", riggedLeftHand.LeftIndexDistal);
      rigRotation("LeftMiddleProximal", riggedLeftHand.LeftMiddleProximal);
      rigRotation(
        "LeftMiddleIntermediate",
        riggedLeftHand.LeftMiddleIntermediate
      );
      rigRotation("LeftMiddleDistal", riggedLeftHand.LeftMiddleDistal);
      rigRotation("LeftThumbProximal", riggedLeftHand.LeftThumbProximal);
      rigRotation("LeftThumbIntermediate", riggedLeftHand.LeftThumbIntermediate);
      rigRotation("LeftThumbDistal", riggedLeftHand.LeftThumbDistal);
      rigRotation("LeftLittleProximal", riggedLeftHand.LeftLittleProximal);
      rigRotation(
        "LeftLittleIntermediate",
        riggedLeftHand.LeftLittleIntermediate
      );
      rigRotation("LeftLittleDistal", riggedLeftHand.LeftLittleDistal);
    }
    if (rightHandLandmarks) {
      riggedRightHand = Hand.solve(rightHandLandmarks, "Right");
      rigRotation("RightHand", {
        // Combine Z axis from pose hand and X/Y axis from hand wrist rotation
        z: riggedPose.RightHand.z,
        y: riggedRightHand.RightWrist.y,
        x: riggedRightHand.RightWrist.x,
      });
      rigRotation("RightRingProximal", riggedRightHand.RightRingProximal);
      rigRotation("RightRingIntermediate", riggedRightHand.RightRingIntermediate);
      rigRotation("RightRingDistal", riggedRightHand.RightRingDistal);
      rigRotation("RightIndexProximal", riggedRightHand.RightIndexProximal);
      rigRotation(
        "RightIndexIntermediate",
        riggedRightHand.RightIndexIntermediate
      );
      rigRotation("RightIndexDistal", riggedRightHand.RightIndexDistal);
      rigRotation("RightMiddleProximal", riggedRightHand.RightMiddleProximal);
      rigRotation(
        "RightMiddleIntermediate",
        riggedRightHand.RightMiddleIntermediate
      );
      rigRotation("RightMiddleDistal", riggedRightHand.RightMiddleDistal);
      rigRotation("RightThumbProximal", riggedRightHand.RightThumbProximal);
      rigRotation(
        "RightThumbIntermediate",
        riggedRightHand.RightThumbIntermediate
      );
      rigRotation("RightThumbDistal", riggedRightHand.RightThumbDistal);
      rigRotation("RightLittleProximal", riggedRightHand.RightLittleProximal);
      rigRotation(
        "RightLittleIntermediate",
        riggedRightHand.RightLittleIntermediate
      );
      rigRotation("RightLittleDistal", riggedRightHand.RightLittleDistal);
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
