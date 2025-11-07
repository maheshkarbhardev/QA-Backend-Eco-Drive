const bcrypt = require("bcryptjs"); //import bcrypt library for hash and compare passwords safely. 
const db = require("../config/db");
const jwt = require("jsonwebtoken"); // import JSON WEB TOKEN for authentication.

//SignUp API
exports.signUp = async (req, res) => {
  try {
    const { userName, email, password, confirmPassword } = req.body; //Pulls userName, email, password, and confirmPassword from the HTTP request body.

    //validate input
    if (!userName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }
    //to check password and confirm password are matching or not?
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords does not match." });
    }

    //create hash password
    const hashPassword = await bcrypt.hash(password, 10);

    //Insert new admin into database
    await db.query(
      "INSERT INTO admin (userName,email,password) VALUES (?,?,?)",
      [userName, email, hashPassword]
    );

    res.status(201).json({ message: "Admin registered successfully." });
  } catch (error) {
    console.log("Signup Error:- ", error);
    res.status(500).json({ message: "Server Error" });
  }
};

//SignIn API
exports.signIn = async (req, res) => {
  try {
    const { userName, password } = req.body; //Extracts userName and password from the request body.

    //to check is userName and password is given or not?
    if (!userName || !password) {
      return res
        .status(400)
        .json({ message: "Please provide userName and password" });
    }

    //if user is exists in database
    const [rows] = await db.query("SELECT * FROM admin WHERE userName=?", [
      userName,
    ]);

    //if user is not exist
    if (rows.length === 0) {
      return res.status(404).json({ message: "User Not Found." });
    }

    const user = rows[0];  //taking first row as a user.

    //compare password
    const isMatch = await bcrypt.compare(password, user.password); //checks the plaintext password against the stored hashed password user.password.

    //if password does not match
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    //Generate Token
    const token = jwt.sign(
      {
        id: user.id,
        userName: user.userName,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } //sets the token to expire in 1 day.
    );

    //Returns 200 OK with the user object (id, userName, email) and the token. The client can store this token and use it to authenticate future requests (usually in an Authorization: Bearer <token> header).
    return res.status(200).json({
      user: {
        id: user.id,
        userName: user.userName,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.log("Error in signIn:- ", error);
    res.status(500).json({ message: "Server Error" });
  }
};
