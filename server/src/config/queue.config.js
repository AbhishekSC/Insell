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
    consumeFromQueue();
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
      const parsedData = JSON.parse(Buffer.from(data.content)); // convert the binary data to js object

      // logger.info("Consuming from message queue: ", parsedData);

      const reponse= await sendEmail(parsedData.email, parsedData.name || "User");

      if(reponse.success === true){
        return channel.ack(data);
      }

     
      //Re-attempting to consume again
    // const maxRetries = 5;
    const maxRetries = 2;
    let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      reponse= await sendEmail(parsedData.email, parsedData.name || "User");
      if(reponse.success === true){
        return channel.ack(data);
      }
    } catch (error) {
      // logger.error(`Again consuming emails: ${parsedData.email}`);

      // Wait exponentially before retrying
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));

      if (attempt >= maxRetries) {
        // logger.error(`Failed to Fail to consume emails, attempts: ${attempt}, emails: ${parsedData.email}`);
      }
    }
  }      
    });

  } catch (error) {
    logger.error("Error consuming from message queue", error);
  }
}

export { connectQueue, publishToQueue, consumeFromQueue };
