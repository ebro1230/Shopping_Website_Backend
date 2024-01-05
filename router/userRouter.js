require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { checkFileType } = require("../utils");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../middlewares/auth");
const secret = process.env.MY_SECRET;
const { s3 } = require("../s3.js");
const { PutObjectCommand } = require("../s3.js");
const { GetObjectCommand } = require("../s3.js");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const saltRounds = 10;

const generateToken = (data) => {
  return jwt.sign(data, secret, { expiresIn: "1h" }); //token expires in 30 minutes
};

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
});

router.get("/:email", async (req, res) => {
  const { email } = req.params;
  User.findOne({ email })
    .then((user) => {
      return res.status(200).json(user);
    })
    .catch((e) => {
      console.log(e);
      return res.sendStatus(404);
    });
});

//creates a user
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  let cart = req.body.cart;
  let userType = req.body.userType;
  User.findOne({ email }).then((user) => {
    if (user) {
      console.log(user);
      return res.status(404).json({ message: "Email Already Exists" });
    } else {
      if (!cart) {
        cart = [];
      }
      if (!userType) {
        userType = "customer";
      }
      bcrypt
        .hash(password, saltRounds)
        .then((hashedPassword) => {
          User.create({
            email,
            password: hashedPassword,
            cart,
            userType,
          });
        })
        .then((data) => res.status(200).json(data))
        .catch((e) => console.log(e.message));
    }
  });
});

router.put("/login", (req, res) => {
  const { email, password } = req.body;
  let updatedUser = [];
  console.log(req.body.cart.length);
  let cart = [];
  User.findOne({ email }).then((user) => {
    //console.log("Old Cart:");
    //console.log(user);
    if (!user) {
      return res.status(404).send("email not found");
    } else {
      bcrypt.compare(password, user.password).then((validPassword) => {
        if (!validPassword) {
          return res.status(404).send("password incorrect");
        } else {
          if (user.cart.length === 0) {
            console.log("Cart Length Zero");
            cart = req.body.cart;
          } else if (req.body.cart.length === 0) {
            console.log("No New Cart Items");
            cart = user.cart;
          } else {
            console.log("Cart Has a Length");
            cart = user.cart.map((item) => {
              if (req.body.cart.find((cartItem) => cartItem.id === item.id)) {
                cartItem = req.body.cart.find(
                  (cartItem) => cartItem.id === item.id
                );
                return {
                  category: cartItem.category,
                  description: cartItem.description,
                  id: cartItem.id,
                  itemId: cartItem.id,
                  image: cartItem.image,
                  price: cartItem.price,
                  rating: cartItem.rating,
                  title: cartItem.title,
                  quantity: Number(cartItem.quantity) + Number(item.quantity),
                };
              } else {
                return item;
              }
            });
            req.body.cart.forEach((cartItem) => {
              if (!cart.find((item) => cartItem.id === item.id)) {
                cart = [...cart, cartItem];
              }
            });
          }
          User.findOneAndUpdate(
            { email: email },
            { cart: cart },
            { new: true }
          ).then((newUser) => {
            updatedUser = newUser;
            //console.log("New Cart:");
            //console.log(newUser);
            const token = generateToken({ email: user.email });
            const response = newUser;
            res.json({ token, response });
          });
        }
      });
    }
  });
});

// DELETE Create an endpoint that DELETES an user
router.delete("/:id/cart", (req, res) => {
  const { id } = req.params;
  User.findByIdAndDelete(id)
    .then((data) => {
      if (!data) {
        // Send 404 if no product is found with the specified _id
        return res.sendStatus(404);
      }
      console.log("Profile Deleted");
      res.sendStatus(204);
    })
    .catch((err) => {
      console.log(err.message);
      res.sendStatus(500);
    });
});

module.exports = router;
