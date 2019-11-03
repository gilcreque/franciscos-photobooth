(function() {
  "use strict";

  //   *** Variables we use a bunch ***

  // Send SMS button
  const sendBtn = document.getElementById("uploadLink");
  // Take photo button
  const shutterBtn = document.getElementById("shutter");
  // Overlay when photo is done
  const previewWrapper = document.getElementById("preview-wrapper");

  // *** button text ***

  // maing screen buttons
  const shutterBtnDefault = "📸 Take photo! 📸";
  const shutterBtnActive = "Smile! 😃";
  // sms button
  const phoneBtnDefault = "📱";
  const phoneBtnValid = "Send 💌";
  const phoneBtnWorking = "Sending...";

  var running = false,
    ready = false,
    footerImage = new Image(),
    base_config = {
      ramp_time: 500,
      frame_delay: 300,
      num_frames: 10,
      prep_time: 6000,
      footer_image: "/Birthday-Codey.png",
      num_poses: 3,
      rows: 2,
      cols: 2,
      gutter: 10,
      gutter_color: "deeppink",
      width: 1024,
      height: 1024
    };

  footerImage.crossOrigin = "anonymous";

  for (var name in base_config) {
    var input = document.getElementById("config_" + name);
    if (input) {
      input.value = base_config[name];
    }
  }

  function config(name) {
    var input = document.getElementById("config_" + name);
    if (input && input.value.length) {
      var value = input.value;
      if (name === "gutter_color") {
        return value;
      } else if (name === "auto_download") {
        return input.checked;
      } else if (parseInt(value)) {
        return parseInt(value);
      }
    }
    return base_config[name];
  }

  // computes the size of each gif
  function getTargetHeight() {
    return Math.floor(
      (config("height") - config("gutter")) / config("rows") - config("gutter")
    );
  }

  // computes width + gutters
  function getTargetWidth() {
    return Math.floor(
      (config("width") - config("gutter")) / config("cols") - config("gutter")
    );
  }

  function sleep(time) {
    return new Promise(function(resolve) {
      setTimeout(resolve, time);
    });
  }

  function setStatus(text, body_class) {
    var status = document.getElementById("statustext");
    status.textContent = text;
    status.blur();
    document.body.classList = body_class || "";
  }

  function prepFrames() {
    var frames = [],
      context;
    let footerWidth, footerHeight;
    if (config("footer_image")) {
      footerWidth = getTargetWidth();
      footerHeight = Math.round(
        (footerWidth / footerImage.width) * footerImage.height
      );
    }
    for (var i = 0; i < config("num_frames"); ++i) {
      frames[i] = document.createElement("canvas");
      frames[i].width = config("width");
      frames[i].height = config("height");
      context = frames[i].getContext("2d");
      context.fillStyle = config("gutter_color");
      context.fillRect(0, 0, frames[i].width, frames[i].height);
      if (config("footer_image")) {
        context.drawImage(
          footerImage,
          (config("cols") - 1) * getTargetWidth() +
            config("cols") * config("gutter"),
          frames[i].height - config("gutter") - footerHeight,
          footerWidth,
          footerHeight
        );
      }
    }
    return frames;
  }

  function setCountdown(i) {
    if (config("prep_time") > 3000) {
      var pose_time = config("frame_delay") * config("num_frames");
      sleep(
        config("prep_time") * i + (config("prep_time") - 3000) + pose_time * i
      ).then(function() {
        for (let count = 0; count < 3; ++count) {
          sleep(1000 * count).then(function() {
            setStatus(3 - count, "count");
          });
        }
      });
    }
  }

  function drawPose(frame, i) {
    var target_height = getTargetHeight();
    var target_width = getTargetWidth();
    var context = frame.getContext("2d");
    var video = document.getElementById("videomirror");
    // new math for cols and rows
    let x = i % config("cols");
    let y = Math.floor(i / config("cols"));
    context.drawImage(
      video,
      x * target_width + (x + 1) * config("gutter"),
      y * target_height + (y + 1) * config("gutter"),
      target_width,
      target_height
    );
  }

  function compileGIF(frames) {
    var gif = new GIF({
      workers: 2,
      workerScript: "gif.worker.js",
      quality: 10
    });
    for (var i in frames) {
      gif.addFrame(frames[i], { delay: 200 });
    }
    var preview = document.getElementById("preview");
    gif.on("finished", function(blob) {
      if (preview.src) {
        URL.revokeObjectURL(preview.src);
      }
      var url = URL.createObjectURL(blob);
      preview.src = url;
      var downloadlink = document.getElementById("downloadlink");
      downloadlink.href = url;
      downloadlink.download = "glitch-xoxo2019.gif";

      previewWrapper.classList.add("active");
      setStatus("Ready! Make sure to look up here 👆🏾 and move around!");
      document.querySelector("#uploadLink").onclick = function(e) {
        e.preventDefault();
        uploadMedia(blob);
      };
    });
    gif.render();
    running = false;
    setStatus("Loading GIF");
  }

  function toggleCaptureButton() {
    if (ready && !running) {
      shutterBtn.removeAttribute("disabled");
      shutterBtn.innerHTML = shutterBtnDefault;
    } else {
      // shutterBtn.style.display = "none";
      shutterBtn.disabled = true;
      shutterBtn.innerHTML = shutterBtnActive;
    }
  }

  function resetForm() {
    document.getElementById("phone-number").value = "";
    sendBtn.disabled = true;
    sendBtn.innerHTML = phoneBtnDefault;
  }

  function startCapture() {
    if (ready && !running) {
      setStatus("Get ready...", "ready");
      previewWrapper.classList.remove("active");
      running = true;
      var num_frames = config("num_frames");
      var frame_delay = config("frame_delay");
      var pose_time = frame_delay * num_frames;
      var frames = prepFrames();
      var rows = config("num_poses");
      for (let i = 0; i < rows; ++i) {
        setCountdown(i);
        sleep(config("prep_time") * (i + 1) + pose_time * i).then(function() {
          for (let j = 0; j < num_frames; ++j) {
            sleep(frame_delay * j).then(function() {
              setStatus("Pose!", "pose");
              drawPose(frames[j], i);
              if (j === num_frames - 1) {
                setStatus("Get Ready...", "ready");
              }
              if (i === rows - 1 && j === num_frames - 1) {
                compileGIF(frames);
              }
            });
          }
        });
      }
    }
    // changes button styling
    toggleCaptureButton();
  }

  shutterBtn.onclick = startCapture;

  document.getElementById("closelink").onclick = function() {
    preview.parentElement.classList.remove("active");

    resetForm();
    // reset button
    toggleCaptureButton();
  };

  document.onkeypress = function(event) {
    if (event.keyCode === 13) {
      if (previewWrapper.classList.contains("active")) {
        previewWrapper.classList.remove("active");
      } else {
        startCapture();
      }
    }
  };

  function drawVideoMirror(video) {
    var target_height = getTargetHeight();
    var target_width = getTargetWidth();
    var videomirror = document.getElementById("videomirror");
    videomirror.width = target_width;
    videomirror.height = target_height;
    var context = videomirror.getContext("2d");
    var ratio = Math.max(
      target_width / video.videoWidth,
      target_height / video.videoHeight
    );
    var x = (target_width - video.videoWidth * ratio) / 2;
    var y = (target_height - video.videoHeight * ratio) / 2;
    context.translate(videomirror.width, 0);
    context.scale(-1, 1);
    context.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      video.videoHeight,
      x,
      y,
      video.videoWidth * ratio,
      video.videoHeight * ratio
    );
  }

  if (navigator && navigator.mediaDevices) {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then(function(stream) {
        var video = document.getElementById("video");
        video.srcObject = stream;
        video.play();
        video.addEventListener(
          "canplay",
          function() {
            function start() {
              setTimeout(function() {
                ready = true;
                setStatus(
                  "Camera ready! Make sure to look up here 👆🏾 and move around!"
                );
                function update() {
                  drawVideoMirror(video);
                  requestAnimationFrame(update);
                }
                update();
              }, config("ramp_time"));
            }

            if (config("footer_image")) {
              footerImage.onload = start;
              footerImage.src = config("footer_image");
            } else {
              start();
            }
          },
          false
        );
      })
      .catch(function(e) {
        console.log(e);
        setStatus("Webcam issues. Did you deny access? 😿", "error");
      });
  } else {
    setStatus("Incompatible browser. Chrome latest works! 😿", "error");
  }

  let phoneNumber = document.getElementById("phone-number");

  phoneNumber.oninput = function() {
    // checks that phone number is valid
    const phoneNumberPattern = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;

    let isValid = phoneNumberPattern.test(phoneNumber.value);

    if (isValid) {
      sendBtn.removeAttribute("disabled");
      sendBtn.innerHTML = phoneBtnValid;
    } else {
      sendBtn.disabled = true;
      sendBtn.innerHTML = phoneBtnDefault;
    }
  };

  function uploadMedia(blob) {
    const token = document.body.getAttribute("data-csrf");

    sendBtn.disabled = true;
    sendBtn.innerHTML = phoneBtnWorking;

    fetch("/upload", {
      credentials: "same-origin",
      body: blob,
      method: "POST",
      headers: {
        "CSRF-Token": token,
        "content-type": "image/gif"
      }
    })
      .then(res => res.json())
      .then(res => {
        let id = res.id;
        let phone = document.querySelector("#phone-number").value;
        if (!phone) {
          return;
        }
        return fetch("/mms", {
          credentials: "same-origin",
          body: JSON.stringify({
            media: id,
            phone
          }),
          method: "POST",
          headers: {
            "CSRF-Token": token,
            "content-type": "application/json"
          }
        }).then(res => {
          // console.log(res)
          alert("Yay, message sent! Check your device!");
          resetForm();
        });
      })
      .catch(e => {
        console.error(e);
        alert("Oh no! Something went wrong. Try again.");
      });
  }
})();
