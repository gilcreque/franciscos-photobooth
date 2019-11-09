``; // init project
const express = require("express");
const app = express();
const fs = require("fs-extra");
const uuid = require("uuid/v4");
const csrf = require("csurf");
const Twilio = require("twilio");
const sassMiddleware = require("node-sass-middleware");

const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const MAX_MEDIA_AGE = 1000 * 60 * 5;
const mediaDir = "./public/gifs/";

function uploadFileToS3(fileName) {
  fs.readFile(mediaDir + fileName, (err, data) => {
    if (err) throw err;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: fileName,
      Body: data,
      ACL: "public-read"
    };
    s3.upload(params, function(s3Err, data) {
      if (s3Err) {
        console.log(`S3 Error ${s3Err}`);
        throw s3Err;
      }
      console.log(`S3 File uploaded successfully at ${data.Location}`);
    });
  });
}

// sass needs to go before static file serving to work
app.use(
  sassMiddleware({
    src: __dirname + "/source",
    dest: __dirname + "/public"
  })
);

// static file serving
app.use(express.static("public"));
app.use("/media", express.static(mediaDir));

// middleware for various things
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true
  })
);
app.use(csrf());

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(req, res) {
  let fileContent = fs
    .readFileSync(__dirname + "/views/index.html")
    .toString("utf-8");
  // insert the CSRF token into the response
  res.end(fileContent.replace("<!-- CSRF -->", req.csrfToken()));
});

// upload media assets
app.post("/upload", (req, res) => {
  console.log("upload started");

  // assign a random name
  const id = uuid();
  const fileName = id + ".gif";

  // this is so Buffer.concat doesn't error if nothing comes;
  const dataParts = [Buffer.alloc(0)];

  // collect the chunks of upload data
  req.on("data", d => {
    dataParts.push(d);
  });

  // once the last chunk arrives, store it
  req.on("end", e => {
    // glue the chunks together into one buffer
    const fullData = Buffer.concat(dataParts);
    // write to our media directory
    fs.writeFileSync(mediaDir + fileName, fullData);
    uploadFileToS3(fileName);
    console.log("file saved");

    // tell the client about it
    res.json({
      status: "success",
      id: fileName
    });
  });

  // there was an oops
  req.on("error", e => {
    console.error(e);
    res.sendStatus(500);
  });
});

async function cleanMedia() {
  console.log("cleaning up old media");

  // get file list
  let mediaFiles = await fs.readdir(mediaDir);
  console.log(`found ${mediaFiles.length} media files`);

  // look for only expired media
  const expiredFiles = mediaFiles.filter(file => {
    let stats = fs.statSync(mediaDir + file);
    // is the file older than 5 minutes?
    return Date.now() - stats.birthtimeMs > MAX_MEDIA_AGE;
  });
  console.log(`cleaning up ${expiredFiles.length} expired media files`);

  // do the deletion
  expiredFiles.forEach(file => {
    fs.remove(mediaDir + file);
  });

  // setTimeout(function() {
  //   cleanMedia().catch(e => console.warn(e));
  // }, MAX_MEDIA_AGE);
}

// MMS code. doesn't work yet!
app.post("/mms", function(req, res) {
  const client = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Create options to send the message
  const ourCoolMessage =
    "✨ You look great! Thanks for coming, from your friends at glitch.com 🎏 Want to share this on social? Tag #xoxofest.";
  const mediaURL = `https://${process.env.PROJECT_DOMAIN}.glitch.me/media/${req.body.media}`;
  const options = {
    to: req.body.phone,
    from: process.env.TWILIO_PHONE_NUMBER,
    mediaUrl: [mediaURL],
    body: ourCoolMessage
  };

  // Send the message!
  client.messages.create(options, function(err, response) {
    if (err) {
      console.error(err);
      res.end(
        "oh no, there was an error! Check the app logs for more information."
      );
    } else {
      console.log("success!");
      res.end("successfully sent your message! check your device");
    }
  });
});

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
  // cleanMedia().catch(e => console.warn(e));
});
