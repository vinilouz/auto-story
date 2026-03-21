const React = require("react");

module.exports = {
  Audio: (props) => React.createElement("audio", props),
  Video: (props) => React.createElement("video", props),
  Img: (props) => React.createElement("img", props),
};
