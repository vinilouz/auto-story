const React = require("react");

module.exports = {
  Player: (props) =>
    React.createElement(
      "div",
      { "data-testid": "remotion-player", ...props },
      "Player",
    ),
};
