import { covenant } from "../schema"


export default () => {
  covenant.define("findUser", () => {
    return [
      {
        username: "Jonathan",
        image: "jdeissprofile.png",
      },
    ];
  });
}
