import amqplib from "amqplib";
import { logger } from "../utils/logger.js";
import "dotenv/config";
import { sendEmail } from "../services/Email.service.js";

let channel = null;
let connection = null;

async function connectQueue() {
  try {
    connection = await amqplib.connect(process.env.RABBITMQ_URI);
    channel = await connection.createChannel();

    await channel.assertQueue(process.env.QUEUE_NAME);
    consumeFromQueue()
    logger.info("Connected to message queue");
  } catch (error) {
    logger.error("Error connecting to message queue", error);
  }
}
// ({ event: "user_logged_in", email: user.email, name: user.fullName }
async function publishToQueue(data) {
  try {
    await channel.sendToQueue(
      process.env.QUEUE_NAME,
      Buffer.from(JSON.stringify(data))
    );

    logger.info("Published to message queue");
  } catch (error) {
    logger.error("Error publishing to message queue", error);
  }
}

async function consumeFromQueue() {
  try {
    channel.consume(process.env.QUEUE_NAME, async (data) => {
      const parsedData= JSON.parse(Buffer.from(data.content)); // convert the binary data to js object
      await sendEmail(parsedData.email, parsedData.name || "User");
      channel.ack(data);
    });

    logger.info("Consuming from message queue: ", Buffer.from(data.content));
  } catch (error) {
    logger.error("Error consuming from message queue", error);
  }
}

export { connectQueue, publishToQueue, consumeFromQueue };
