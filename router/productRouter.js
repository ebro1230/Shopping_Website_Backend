require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { checkFileType } = require("../utils");
const Product = require("../models/Product");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("../middlewares/auth");
const secret = process.env.MY_SECRET;
const { s3 } = require("../s3.js");
const { PutObjectCommand } = require("../s3.js");
const { GetObjectCommand } = require("../s3.js");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const generateToken = (data) => {
  return jwt.sign(data, secret, { expiresIn: "1800s" }); //token expires in 30 minutes
};

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
});

//creates a product
router.post(
  "/newproduct",
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    const { title, category, description, price, rating } = req.body;
    Product.findOne({ title }).then((product) => {
      if (product) {
        console.log(product);
        return res.status(404).json({ message: "product already exists" });
      }
    });
    const image = Date.now() + req.files.image[0].originalname;
    const paramsImage = {
      Bucket: process.env.AWS_BUCKET_NAME_PRODUCT,
      Key: image,
      Body: req.files.image[0].buffer,
      ContentType: req.files.image[0].mimetype,
    };
    const commandImage = new PutObjectCommand(paramsImage);
    await s3.send(commandImage);
    Product.create({
      title,
      category,
      description,
      price,
      rating,
      image,
    })
      .then((data) => res.status(200).json(data))
      .catch((e) => console.log(e.message));
  }
);

// router.post("/login", (req, res) => {
//   const { username, password } = req.body;
//   User.findOne({ username }).then((user) => {
//     if (!user) {
//       return res.status(404).send("username not found");
//     }
//     bcrypt.compare(password, user.password).then((validPassword) => {
//       if (!validPassword) {
//         return res.status(404).send("password incorrect");
//       }
//       const token = generateToken({ username: user.username });
//       const response = user;
//       res.json({ token, response });
//     });
//   });
// });

//updates product based on id
router.put(
  "/:id",
  upload.fields([{ name: "image", maxCount: 1 }]),
  async (req, res) => {
    const { id } = req.params;
    const { title, category, description, price, rating } = req.body;

    if (req.files.image) {
      const image = Date.now() + req.files.image[0].originalname;
      const paramsImage = {
        Bucket: process.env.AWS_BUCKET_NAME_PRODUCT,
        Key: image,
        Body: req.files.image[0].buffer,
        ContentType: req.files.image[0].mimetype,
      };
      const commandImage = new PutObjectCommand(paramsImage);
      await s3.send(commandImage);

      Product.findByIdAndUpdate(
        id,
        {
          title,
          category,
          description,
          price,
          rating,
          image,
        },
        { new: true }
      )
        .then((data) => {
          if (!data) {
            // Send 404 if no Product is found with the specified _id
            return res.sendStatus(404);
          }
          res.json(data);
        })
        .catch((e) => {
          console.log(e.message);
          res.sendStatus(500);
        })
        .catch((e) => console.log(e.message));
    } else {
      Product.findByIdAndUpdate(
        id,
        {
          title,
          category,
          description,
          price,
          rating,
        },
        { new: true }
      )
        .then((data) => {
          if (!data) {
            // Send 404 if no artist is found with the specified _id
            return res.sendStatus(404);
          }
          res.json(data);
        })
        .catch((e) => {
          console.log(e.message);
          res.sendStatus(500);
        })
        .catch((e) => console.log(e.message));
    }
  }
);

// DELETE Create an endpoint that DELETES an existing product
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  Product.findByIdAndDelete(id)
    .then((data) => {
      if (!data) {
        // Send 404 if no product is found with the specified _id
        return res.sendStatus(404);
      }
      console.log("Product Deleted");
      res.sendStatus(204);
    })
    .catch((err) => {
      console.log(err.message);
      res.sendStatus(500);
    });
});

//gets product by id
router.get("/:id", (req, res) => {
  const id = req.params.id;
  Product.findById(id)
    .then(async (product) => {
      if (!product) {
        return res.status(404).send("Product not found!");
      } else {
        if (product.image) {
          const getObjectParamsImage = {
            Bucket: process.env.AWS_BUCKET_NAME_PRODUCT,
            Key: product.image,
          };
          const commandImage = new GetObjectCommand(getObjectParamsImage);
          const urlImage = await getSignedUrl(s3, commandImage, {
            expiresIn: 3600,
          });
          product.image = urlImage;
        }
        return res.json(product);
      }
    })
    .catch((e) => {
      console.log(e.message);
      return res.sendStatus(500);
    });
});

//gets products by category
router.get("/categories/:category", (req, res) => {
  const { category } = req.params;
  Product.find({ category: { $eq: category } })
    .then(async (products) => {
      if (!products) {
        return res.status(404).send("Products not found!");
      } else {
        await Promise.all(
          await products.map(async (product) => {
            if (product.image) {
              const getObjectParamsImage = {
                Bucket: process.env.AWS_BUCKET_NAME_PRODUCT,
                Key: product.image,
              };
              const commandImage = new GetObjectCommand(getObjectParamsImage);
              const urlImage = await getSignedUrl(s3, commandImage, {
                expiresIn: 3600,
              });
              product.image = urlImage;
              return product;
            }
          })
        );
        return res.json(products);
      }
    })
    .catch((e) => {
      console.log(e.message);
      return res.sendStatus(500);
    });
});

router.get("/", (req, res) => {
  Product.find()
    .then(async (products) => {
      if (!products) {
        return res.status(404).send("Products not found!");
      } else {
        await Promise.all(
          await products.map(async (product) => {
            if (product.image) {
              const getObjectParamsImage = {
                Bucket: process.env.AWS_BUCKET_NAME_PRODUCT,
                Key: product.image,
              };
              const commandImage = new GetObjectCommand(getObjectParamsImage);
              const urlImage = await getSignedUrl(s3, commandImage, {
                expiresIn: 3600,
              });
              product.image = urlImage;
              return product;
            }
          })
        );
        return res.json(products);
      }
    })
    .catch((e) => {
      console.log(e.message);
      return res.sendStatus(500);
    });
});

module.exports = router;
