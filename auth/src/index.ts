import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { app } from './app';

dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_KEY = process.env.JWT_KEY || 
  (fs.existsSync('/run/secrets/jwt_secret') ? 
   fs.readFileSync('/run/secrets/jwt_secret', 'utf8').trim() : 
   null);

const start = async () => {
  console.log('Iniciando AUTH........', JWT_KEY);

  if (!JWT_KEY) {
    throw new Error('JWT_KEY must be defined');
  }
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be defined');
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });
    console.log('Connected to MongoDb');
  } catch (err) {
    console.error(err);
  }

  app.listen(3000, () => {
    console.log('Listening on port 3000!!!!!!!!');
  });
};

start();
