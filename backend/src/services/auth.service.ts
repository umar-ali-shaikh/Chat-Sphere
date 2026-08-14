import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/generateToken.js";
import env from "../config/env.js";

class AuthService {
  /**
   * Register User
   */

  async register(data: { name: string; email: string; password: string }) {
    const { name, email, password } = data;

    const existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      throw new AppError("User already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  /**
   * Login User
   */

  async login(data: { email: string; password: string }) {
    const { email, password } = data;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      throw new AppError("Invalid email ", 401);
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      throw new AppError("Invalid password", 401);
    }

    const token = generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

}

export default new AuthService();
