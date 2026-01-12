import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true },
  password: String,
}, { timestamps: true });

const contentTypes = ["document", "tweet", "youtube", "link"];
const contentSchema = new mongoose.Schema({
  link: { String },
  title: { String },

  type: { type: String, enum: contentTypes },
  tags: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tags",
    },
  ],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
});

const tagScheam = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const hashSchema = new mongoose.Schema({
  hash: { type: String },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
});

export const UserModel = mongoose.model("Users", userSchema);
export const contentModel = mongoose.model("Contents", contentSchema);
export const linkModel = mongoose.model("Links", hashSchema);
export const tagModel = mongoose.model("Tags", tagScheam);
