import { signOutSuccessMessage } from "./signout.constants.js";

export const signOutService = {
  async logout() {
    return { signedOut: true, message: signOutSuccessMessage };
  },
};
