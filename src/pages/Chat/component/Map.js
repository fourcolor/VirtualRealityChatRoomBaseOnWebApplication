import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree, Object3D } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { VRM, VRMSchema, VRMUtils } from "@pixiv/three-vrm";
import { useControls } from "leva";
import { Vector3, Quaternion, Euler, Vector2 } from "three";
import { faceSolver } from "../../../utils/faceSolver";
import { handSolver } from "../../../utils/handSolver";
import * as Kalidokit from "kalidokit";
import { Vector, Face, Pose, Hand } from "kalidokit";
// import * as tf from "@tensorflow/tfjs";
// import * as poseDetection from "@tensorflow-models/pose-detection";
// import { Face, Pose, Hand } from "kalidokit";
// import Webcam from "react-webcam";
let currentVrm;
const remap = Kalidokit.Utils.remap;
const clamp = Kalidokit.Utils.clamp;
const lerp = Kalidokit.Vector.lerp;
const rigRotation = (
  Part,
  rotation = { x: 0, y: 0, z: 0 },
  dampener = 1.3,
  lerpAmount = 0.7 
) => {
  if (!currentVrm) {
    return;
  }
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
const rigFace = (Neck,riggedFace) => {
  if (!currentVrm) {
    return;
  }
  rigRotation(Neck, riggedFace.head, 0.7);

  // Blendshapes and Preset Name Schema
  const Blendshape = currentVrm.blendShapeProxy;
  const PresetName = VRMSchema.BlendShapePresetName;

  // Simple example without winking. Interpolate based on old blendshape, then stabilize blink with `Kalidokit` helper function.
  // for VRM, 1 is closed, 0 is open.
  riggedFace.eye.l = lerp(
    clamp(1 - riggedFace.eye.l, 0, 1),
    Blendshape.getValue(PresetName.Blink),
    0.5
  );
  riggedFace.eye.r = lerp(
    clamp(1 - riggedFace.eye.r, 0, 1),
    Blendshape.getValue(PresetName.Blink),
    0.5
  );
  riggedFace.eye = Face.stabilizeBlink(riggedFace.eye, riggedFace.head.y);
  Blendshape.setValue(PresetName.Blink, riggedFace.eye.l);

  // Interpolate and set mouth blendshapes
  Blendshape.setValue(
    PresetName.I,
    Vector.lerp(
      riggedFace.mouth.shape.I,
      Blendshape.getValue(PresetName.I),
      0.5
    )
  );
  Blendshape.setValue(
    PresetName.A,
    Vector.lerp(
      riggedFace.mouth.shape.A,
      Blendshape.getValue(PresetName.A),
      0.5
    )
  );
  Blendshape.setValue(
    PresetName.E,
    Vector.lerp(
      riggedFace.mouth.shape.E,
      Blendshape.getValue(PresetName.E),
      0.5
    )
  );
  Blendshape.setValue(
    PresetName.O,
    Vector.lerp(
      riggedFace.mouth.shape.O,
      Blendshape.getValue(PresetName.O),
      0.5
    )
  );
  Blendshape.setValue(
    PresetName.U,
    Vector.lerp(
      riggedFace.mouth.shape.U,
      Blendshape.getValue(PresetName.U),
      0.5
    )
  );

  //PUPILS
  //interpolate pupil and keep a copy of the value
  let lookTarget = new Euler(
    lerp(oldLookTarget.x, riggedFace.pupil.y, 0.4),
    lerp(oldLookTarget.y, riggedFace.pupil.x, 0.4),
    0,
    "XYZ"
  );
  oldLookTarget.copy(lookTarget);
  currentVrm.lookAt.applyer.lookAt(lookTarget);
};

// const NBox = ({ position, args }) => {
//   const mesh = useRef(null);
//   useFrame(() => (mesh.current.rotation.x = mesh.current.rotation.y += 0.01));
//   return (
//     <mesh ref={mesh} position={position}>
//       <boxBufferGeometry attach="geometry" args={args} />
//       <meshStandardMaterial attach="material" color="lightblue" />
//     </mesh>
//   );
// };
const Avatar = (props) => {
  const { scene, camera } = useThree();
  const gltf = useGLTF(
    "https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm?v=1630342336981"
  );
  // const gltf = useGLTF("../../../../three-vrm-girl.vrm");
  // const gltf = useGLTF("../../../../model.glb");
  const avatar = useRef();
  const [bonesStore, setBones] = useState({});
  useEffect(() => {
    if (gltf) {
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      VRM.from(gltf).then((vrm) => {
        avatar.current = vrm;
        currentVrm = vrm;
        vrm.lookAt.target = camera;
        vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips).rotation.y =
          Math.PI;

        const bones = {
          Neck: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Neck),
          Hips: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Hips),
          Chest: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Chest),
          Spine: vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Spine),
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
    const results = keypoints;
    let riggedPose, riggedLeftHand, riggedRightHand, riggedFace;
    if (results) {
      console.log(results)
      riggedFace = results.face;
      riggedPose = results.pose;
      riggedLeftHand = results.hand.left;
      riggedRightHand = results.hand.right;
      rigFace(bonesStore.Neck,riggedFace);
      rigRotation(bonesStore.Hips, riggedPose.Hips.rotation, 0.7);
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

      rigRotation(bonesStore.Chest, riggedPose.Spine, 0.25, 0.3);
      rigRotation(bonesStore.Spine, riggedPose.Spine, 0.45, 0.3);

      rigRotation(bonesStore.RightUpperArm, riggedPose.RightUpperArm, 1, 0.3);
      rigRotation(bonesStore.RightLowerArm, riggedPose.RightLowerArm, 1, 0.3);
      rigRotation(bonesStore.LeftUpperArm, riggedPose.LeftUpperArm, 1, 0.3);
      rigRotation(bonesStore.LeftLowerArm, riggedPose.LeftLowerArm, 1, 0.3);

      rigRotation(bonesStore.LeftUpperLeg, riggedPose.LeftUpperLeg, 1, 0.3);
      rigRotation(bonesStore.LeftLowerLeg, riggedPose.LeftLowerLeg, 1, 0.3);
      rigRotation(bonesStore.RightUpperLeg, riggedPose.RightUpperLeg, 1, 0.3);
      rigRotation(bonesStore.RightLowerLeg, riggedPose.RightLowerLeg, 1, 0.3);
      if (riggedLeftHand) {
        rigRotation(bonesStore.LeftHand, {
          // Combine pose rotation Z and hand rotation X Y
          z: riggedPose.LeftHand.z,
          y: riggedLeftHand.LeftWrist.y,
          x: riggedLeftHand.LeftWrist.x,
        });
        rigRotation(
          bonesStore.LeftRingProximal,
          riggedLeftHand.LeftRingProximal
        );
        rigRotation(
          bonesStore.LeftRingIntermediate,
          riggedLeftHand.LeftRingIntermediate
        );
        rigRotation(bonesStore.LeftRingDistal, riggedLeftHand.LeftRingDistal);
        rigRotation(
          bonesStore.LeftIndexProximal,
          riggedLeftHand.LeftIndexProximal
        );
        rigRotation(
          bonesStore.LeftIndexIntermediate,
          riggedLeftHand.LeftIndexIntermediate
        );
        rigRotation(bonesStore.LeftIndexDistal, riggedLeftHand.LeftIndexDistal);
        rigRotation(
          bonesStore.LeftMiddleProximal,
          riggedLeftHand.LeftMiddleProximal
        );
        rigRotation(
          bonesStore.LeftMiddleIntermediate,
          riggedLeftHand.LeftMiddleIntermediate
        );
        rigRotation(
          bonesStore.LeftMiddleDistal,
          riggedLeftHand.LeftMiddleDistal
        );
        rigRotation(
          bonesStore.LeftThumbProximal,
          riggedLeftHand.LeftThumbProximal
        );
        rigRotation(
          bonesStore.LeftThumbIntermediate,
          riggedLeftHand.LeftThumbIntermediate
        );
        rigRotation(bonesStore.LeftThumbDistal, riggedLeftHand.LeftThumbDistal);
        rigRotation(
          bonesStore.LeftLittleProximal,
          riggedLeftHand.LeftLittleProximal
        );
        rigRotation(
          bonesStore.LeftLittleIntermediate,
          riggedLeftHand.LeftLittleIntermediate
        );
        rigRotation(
          bonesStore.LeftLittleDistal,
          riggedLeftHand.LeftLittleDistal
        );
      }
      if (riggedRightHand) {
        rigRotation(bonesStore.RightHand, {
          // Combine Z axis from pose hand and X/Y axis from hand wrist rotation
          z: riggedPose.RightHand.z,
          y: riggedRightHand.RightWrist.y,
          x: riggedRightHand.RightWrist.x,
        });
        rigRotation(
          bonesStore.RightRingProximal,
          riggedRightHand.RightRingProximal
        );
        rigRotation(
          bonesStore.RightRingIntermediate,
          riggedRightHand.RightRingIntermediate
        );
        rigRotation(
          bonesStore.RightRingDistal,
          riggedRightHand.RightRingDistal
        );
        rigRotation(
          bonesStore.RightIndexProximal,
          riggedRightHand.RightIndexProximal
        );
        rigRotation(
          bonesStore.RightIndexIntermediate,
          riggedRightHand.RightIndexIntermediate
        );
        rigRotation(
          bonesStore.RightIndexDistal,
          riggedRightHand.RightIndexDistal
        );
        rigRotation(
          bonesStore.RightMiddleProximal,
          riggedRightHand.RightMiddleProximal
        );
        rigRotation(
          bonesStore.RightMiddleIntermediate,
          riggedRightHand.RightMiddleIntermediate
        );
        rigRotation(
          bonesStore.RightMiddleDistal,
          riggedRightHand.RightMiddleDistal
        );
        rigRotation(
          bonesStore.RightThumbProximal,
          riggedRightHand.RightThumbProximal
        );
        rigRotation(
          bonesStore.RightThumbIntermediate,
          riggedRightHand.RightThumbIntermediate
        );
        rigRotation(
          bonesStore.RightThumbDistal,
          riggedRightHand.RightThumbDistal
        );
        rigRotation(
          bonesStore.RightLittleProximal,
          riggedRightHand.RightLittleProximal
        );
        rigRotation(
          bonesStore.RightLittleIntermediate,
          riggedRightHand.RightLittleIntermediate
        );
        rigRotation(
          bonesStore.RightLittleDistal,
          riggedRightHand.RightLittleDistal
        );
      }
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
