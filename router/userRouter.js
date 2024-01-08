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

const handleUpdateUserCart = (user, cart, req, res) => {
  if (user.cart.length === 0) {
    cart = req.body.cart;
  } else if (req.body.cart.length === 0) {
    cart = user.cart;
  } else {
    cart = user.cart.map((item) => {
      if (req.body.cart.find((cartItem) => cartItem.id === item.id)) {
        cartItem = req.body.cart.find((cartItem) => cartItem.id === item.id);
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
    { email: user.email },
    { cart: cart },
    { new: true }
  ).then((newUser) => {
    const response = "Cart Updated";
    res.json({ newUser, response });
  });
};

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
  let cart = [];
  User.findOne({ email }).then((user) => {
    if (!user) {
      return res.status(404).send("email not found");
    } else {
      bcrypt.compare(password, user.password).then((validPassword) => {
        if (!validPassword) {
          return res.status(404).send("password incorrect");
        } else {
          handleUpdateUserCart(user, cart, req, res);
        }
      });
    }
  });
});

router.put("/:id/emptyCart", (req, res) => {
  const { id } = req.params;
  User.findByIdAndUpdate({ _id: id }, { cart: [] }, { new: true }).then(
    (user) => {
      const message = "Cart Emptied";
      res.json({ user, message }).status(204);
    }
  );
});

router.put("/:id/updateCart2", (req, res) => {
  const { id } = req.params;
  const { cart } = req.body;
  User.findByIdAndUpdate({ _id: id }, { cart: cart }, { new: true }).then(
    (user) => {
      const message = "Cart Updated";
      res.json({ user, message }).status(204);
    }
  );
});

router.put("/:id/updateCart", (req, res) => {
  const { id } = req.params;
  let cart = [];
  User.findById({ _id: id }).then((user) => {
    handleUpdateUserCart(user, cart, req, res);
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
