import React, { useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import {Holistic} from "@mediapipe/holistic";
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
    width: 320,
    height: 240,
  };

  const runPosenet = async () => {
    const holistic = new Holistic({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/${file}`;
      },
    });
    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
      refineFaceLandmarks: true,
    });
    setInterval(() => {
      detect(holistic);
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

  const detect = async (holistic) => {
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

      const data = await holistic.send({ image: video });
      props.mapJoints({
        data: data,
      });
      console.log(data)
      // drawPose(pose[0], canvasRef.current.getContext("2d"));
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
