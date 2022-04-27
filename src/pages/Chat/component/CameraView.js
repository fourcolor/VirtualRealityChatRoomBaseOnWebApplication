import React, { useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import * as Kalidokit from "kalidokit";
import Webcam from "react-webcam";
import "../index.css";

const CameraView = (props) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const style = {
    position: "absolute",
    marginLeft: "auto",
    marginRight: "auto",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: 9,
    width: 640,
    height: 480,
  };

  const runPosenet = async () => {
    const faceModel = await faceLandmarksDetection.load(
      faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
    );
    const model = poseDetection.SupportedModels.BlazePose;
    const detectorConfig = {
      runtime: "tfjs", // 或者 'tfjs'
      modelType: "full",
    };
    const handmodel = handPoseDetection.SupportedModels.MediaPipeHands;
    const handdetectorConfig = {
      runtime: "tfjs", // or 'tfjs',
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
      modelType: "full",
    };
    const handModel = await handPoseDetection.createDetector(
      handmodel,
      handdetectorConfig
    );
    const net = await poseDetection.createDetector(model, detectorConfig);
    console.log("Posenet loaded");
    setInterval(() => {
      detect(net, faceModel, handModel);
    }, 200);
  };

  const drawPose = (predictions, canvas) => {
    if (predictions.score > 0) {
      const keypoints = predictions.keypoints;
      keypoints.forEach((point) => {
        const x = point.x;
        const y = point.y;
        canvas.beginPath();
        canvas.arc(x, y, 5, 0, 3 * Math.PI);
        canvas.fillStyle = "Indigo";
        canvas.fill();
      });
    }
  };

  const drawFace = (predictions, canvas) => {
    let keypoints = predictions.scaledMesh;
    let x = keypoints[21][0];
    let y = keypoints[21][1];
    canvas.fillStyle = "red";
    canvas.fillRect(x, y, 10, 10);
    x = keypoints[251][0];
    y = keypoints[251][1];
    canvas.fillStyle = "blue";
    canvas.fillRect(x, y, 10, 10);
    x = keypoints[397][0];
    y = keypoints[397][1];
    canvas.fillStyle = "purple";
    canvas.fillRect(x, y, 10, 10);
    x = keypoints[172][0];
    y = keypoints[172][1];
    canvas.fillStyle = "yellow";
    canvas.fillRect(x, y, 10, 10);
  };

  const detect = async (posenet, facenet, handnet) => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      webcamRef.current.video.width = videoWidth;
      webcamRef.current.video.height = videoHeight;

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      const pose = await posenet.estimatePoses(video);
      const face = await facenet.estimateFaces({ input: video });
      const hand = await handnet.estimateHands(video);
      const poseKeypoints3D = pose[0].keypoints3D;
      const poseKeypoints2D = pose[0].keypoints;
      const faceKeypoints3D = face[0].scaledMesh;
      let rightHandlm, leftHandlm;
      if (hand[0]) {
        if (hand[0].handedness === "Right") {
          rightHandlm = hand[0].keypoints3D;
        } else {
          leftHandlm = hand[0].keypoints3D;
        }
      }
      if (hand[1]) {
        if (hand[1].handedness === "Right") {
          rightHandlm = hand[1].keypoints3D;
        } else {
          leftHandlm = hand[1].keypoints3D;
        }
      }
      for (const e of poseKeypoints2D) {
        e.x /= videoWidth;
        e.y /= videoHeight;
        e.z = 0;
      }
      let poseRig = Kalidokit.Pose.solve(poseKeypoints3D, poseKeypoints2D, {
        runtime: "tfjs",
        video: video,
      });
      let faceRig = Kalidokit.Face.solve(faceKeypoints3D, {
        runtime: "mediapipe",
        video: video,
      });
      let rightHandRig,leftHandRig;
      if (rightHandlm) {
        rightHandRig = Kalidokit.Hand.solve(rightHandlm, "Right");
      }
      if (leftHandlm) {
        leftHandRig = Kalidokit.Hand.solve(leftHandlm, "Left");
      }
      const data = {
        pose: poseRig,
        face: faceRig,
        hand: { right: rightHandRig, left: leftHandRig },
      };
      props.mapJoints(data);
      // drawPose(pose[0], canvasRef.current.getContext("2d"));
      drawFace(face[0], canvasRef.current.getContext("2d"));
    }
  };

  runPosenet();

  return (
    <div>
      <Webcam ref={webcamRef} style={style} />
      <canvas ref={canvasRef} style={style} />
    </div>
  );
};

export default CameraView;
