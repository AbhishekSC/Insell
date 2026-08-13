import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectToMongoDB } from "../src/config/db.config.js";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { POST_TYPES } from "../src/utils/postPolicy.js";

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function sampleMany(list, count) {
  const copy = [...list];
  const picked = [];
  while (copy.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * copy.length);
    picked.push(copy[index]);
    copy.splice(index, 1);
  }
  return picked;
}

async function seedUsersAndPosts() {
  const userCount = 15;
  const postsPerUser = 3;
  const password = "Password@123";
  
  mongoose.set("debug", false);

  const firstNames = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Kabir", "Ishaan", "Reyansh", "Ayaan", "Krish",
    "Anaya", "Diya", "Myra", "Aadhya", "Sara", "Riya", "Meera", "Kiara", "Anika", "Ira",
    "Rohan", "Karan", "Arnav", "Advik", "Veer", "Aryan", "Shaurya", "Atharv", "Ishaan", "Kabir",
    "Pari", "Ananya", "Saanvi", "Anvi", "Diya", "Myra", "Aarohi", "Vanya", "Kavya", "Ishita",
    "Dev", "Raj", "Amit", "Sumit", "Vikram", "Rahul", "Saurabh", "Nitin", "Manish", "Deepak",
    "Priya", "Neha", "Sneha", "Pooja", "Rashmi", "Kavita", "Sunita", "Anita", "Rekha", "Suman",
  ];
  const lastNames = [
    "Sharma", "Verma", "Singh", "Gupta", "Mishra", "Yadav", "Khan", "Patel", "Reddy", "Joshi",
    "Kumar", "Das", "Roy", "Chopra", "Malhotra", "Saxena", "Tiwari", "Tripathi", "Dubey", "Pandey",
    "Agarwal", "Jain", "Soni", "Mehta", "Shah", "Bhatia", "Chopra", "Nair", "Iyer", "Menon",
    "Srivastava", "Chaturvedi", "Dixit", "Pandey", "Upadhyay", "Pathak", "Tripathi", "Mishra", "Tiwari", "Srivastava",
  ];
  const cities = [
    "Kanpur", "Lucknow", "Delhi", "Mumbai", "Bengaluru", "Pune", "Jaipur", "Indore", "Kolkata", "Chandigarh",
    "Ahmedabad", "Hyderabad", "Chennai", "Noida", "Gurgaon", "Nagpur", "Surat", "Bhopal", "Visakhapatnam", "Coimbatore",
    "Kochi", "Mysore", "Vadodara", "Nashik", "Faridabad", "Rajkot", "Varanasi", "Aurangabad", "Dhanbad", "Amritsar",
  ];
  const localities = [
    "Connaught Place", "Koramangala", "Andheri West", "Whitefield", "Saket", "Bandra", "Powai", "Gurgaon",
    "Indiranagar", "Jayanagar", "Malad West", "Electronic City", "Dwarka", "Thane", "Vashi", "Sector 62",
    "Banjara Hills", "Anna Nagar", "Sector 18", "Koramangala", "Marathahalli", "HSR Layout", "BTM Layout", "Gachibowli",
    "Connaught Place", "Karol Bagh", "Lajpat Nagar", "South Extension", "Greater Kailash", "Vasant Kunj", "Defence Colony",
    "BKC", "Lower Parel", "Andheri East", "Powai", "Goregaon", "Thane West", "Navi Mumbai", "Panvel",
  ];
  const propertyTypes = ["Apartment", "Independent House", "Villa", "Plot", "Commercial", "Studio", "Penthouse", "Farmhouse", "Row House", "Office Space", "Retail Space", "Warehouse"];
  const listingTypes = ["Sell", "Rent"];
  const postTypes = Object.values(POST_TYPES);
  const roles = ["Broker", "Seller", "Landlord", "Buyer", "Tenant", "Investor", "Developer", "Builder", "Agent", "Consultant"];

  const propertyTitles = [
    "Luxury 3BHK Apartment with City View",
    "Spacious 2BHK in Prime Location",
    "Modern Villa with Private Garden",
    "Commercial Office Space in Business Hub",
    "Cozy 1BHK for Rent Near Metro",
    "Premium 4BHK Penthouse",
    "Budget-friendly Studio Apartment",
    "Retail Space in High Footfall Area",
    "Independent House with Parking",
    "Plot Near Upcoming Metro Station",
    "Sea-facing Villa with Private Beach Access",
    "Smart Home with Latest Technology",
    "Garden-facing Apartment with Balcony",
    "Commercial Complex with Multiple Units",
    "Luxury Penthouse with Rooftop Garden",
    "Spacious Row House in Gated Community",
    "Office Space in IT Park",
    "Farmhouse on Outskirts of City",
    "Studio Apartment in Heart of City",
    "3BHK Flat Near International Airport",
    "Commercial Shop in Busy Market",
    "Independent Villa with Swimming Pool",
    "2BHK Flat Near School and Hospital",
    "Office Space in Business District",
    "Luxury Apartment in Premium Society",
    "Plot for Commercial Development",
    "4BHK Duplex with Modern Amenities",
    "Retail Space in Shopping Mall",
    "Independent House with Large Garden",
    "1BHK Studio for Working Professionals",
    "Commercial Warehouse in Industrial Area",
    "Luxury Villa in Gated Community",
    "3BHK Flat with Modern Amenities",
    "Commercial Office in Prime Location",
    "Independent House with Terrace",
    "Studio Apartment Near Metro Station",
    "Luxury Penthouse with City Views",
    "Commercial Space for Rent",
    "Row House in Premium Location",
    "Farmhouse with Organic Garden",
    "Office Space with Parking",
    "Retail Space in High Street",
    "Independent House with Modern Design",
    "2BHK Flat in Gated Society",
    "Commercial Complex in Business Hub",
  ];

  const captions = [
    "Beautiful property with modern amenities and excellent connectivity. Perfect for families looking for their dream home.",
    "Well-maintained property in a prime location. Close to schools, hospitals, and shopping centers.",
    "Spacious and airy apartment with natural light throughout. Ideal for professionals.",
    "Commercial space with high visibility foot traffic. Great for retail or office use.",
    "Affordable rental option in a safe neighborhood with good transport links.",
    "Premium property with world-class amenities and stunning views. Perfect for luxury living.",
    "Modern construction with earthquake-resistant design and eco-friendly features.",
    "Strategically located property with excellent rental potential and high appreciation value.",
    "Beautifully designed home with contemporary architecture and premium finishes.",
    "Ideal investment opportunity with guaranteed returns and prime location.",
    "Spacious layout with modern kitchen and premium fittings. Ready to move in.",
    "Commercial property in developing area with high growth potential.",
    "Luxury villa with private pool, garden, and 24/7 security. Perfect for families.",
    "Well-connected property near metro station and major highways. Excellent connectivity.",
    "Premium office space with modern amenities and parking facilities.",
    "Beautiful apartment with panoramic city views and modern amenities.",
    "Commercial retail space in high-footfall area with excellent visibility.",
    "Independent house with large garden and ample parking space.",
    "Studio apartment perfect for young professionals and students.",
    "Luxury penthouse with rooftop terrace and stunning city views.",
    "Modern office space with state-of-the-art facilities and excellent connectivity.",
    "Spacious commercial warehouse in industrial area with easy access to transport.",
    "Beautiful farmhouse with organic garden and peaceful surroundings.",
    "Premium retail space in shopping mall with high footfall and excellent visibility.",
    "Well-designed independent house with modern architecture and premium finishes.",
    "Cozy studio apartment near metro station with excellent connectivity.",
    "Luxury penthouse with panoramic views and premium amenities.",
    "Commercial space for rent in prime business district with excellent visibility.",
    "Spacious row house in gated community with modern amenities and security.",
    "Beautiful farmhouse with organic garden and peaceful environment.",
    "Modern office space with parking and excellent connectivity to major business hubs.",
    "Premium retail space in high street location with excellent foot traffic.",
    "Independent house with contemporary design and modern amenities.",
    "Well-located 2BHK flat in gated society with excellent amenities.",
    "Commercial complex in business hub with multiple units and excellent visibility.",
  ];

  const sampleImages = [
    "https://imgs.search.brave.com/mXlG21SIO7A_8Ny8J6-feOxcxa0aGRqN79wDHlnwlXE/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9idXJz/dC5zaG9waWZ5Y2Ru/LmNvbS9waG90b3Mv/aG91c2UtaW4tdHJl/ZXMuanBnP3dpZHRo/PTEwMDAmZm9ybWF0/PXBqcGcmZXhpZj0w/JmlwdGM9MA",
    "https://imgs.search.brave.com/RqaX___ejb7UKPOR6aWHeqRf3h63UraNYjt46iZme5Q/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvNDcz/NjAyMzk2L3Bob3Rv/L3JlYWwtZXN0YXRl/LWhvbWUtd2l0aC1n/YXJkZW4tbWVhZG93/LWVpbmZhbWlsaWVu/aGF1cy5qcGc_cz02/MTJ4NjEyJnc9MCZr/PTIwJmM9cEVPOEQt/eFMzZDNUS0lRUTBs/YXNVcDE5OGhMbUt6/dTRFdDF6bXFIZE9U/WT0",
    "https://imgs.search.brave.com/IJJmzwSiQYrsg3cLsmASUdpw_GUi2HHiWe7kzFXGyJc/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wMTUv/ODEyLzcyNS9zbWFs/bC9tb2Rlcm4tbHV4/dXJ5LWhvdXNlLWFu/ZC1nYXJkZW4tcGhv/dG8uanBn",
    "https://imgs.search.brave.com/995cpJmz6Rs8vAQmEw6woJPi8CfBIKXn84xHlUkmZcM/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9pbWcu/bWFnbmlmaWMuY29t/L2ZyZWUtcGhvdG8v/aG91c2UtaXNvbGF0/ZWQtZmllbGRfMTMw/My0yMzc3My5qcGc_/c2VtdD1haXNfaHli/cmlkJnc9NzQwJnE9/ODA",
    "https://imgs.search.brave.com/Q1f3vdne_LmwAsE6nqZdvZLMenH2O8HS958DCgSG_Nk/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wMjQv/Njg1LzY2Ni9zbWFs/bC9hdHRyYWN0aXZl/LWFuZC1tb2Rlcm4t/aG91c2UtZ2VuZXJh/dGl2ZS1haS1mcmVl/LXBob3RvLmpwZw",
    "https://imgs.search.brave.com/o6GC4V0dvodXUtz0nwCyvBpdZLuPY08i1Mv9e4HM_kE/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vb3Jp/Z2luYWxzL2U0Lzk4/LzVhL2U0OTg1YTU2/MzI0ZGEwZGU3OTE1/ZTU5MjVhOTllZWUz/LmpwZw",
  ];

  await connectToMongoDB();

  const hashedPassword = await bcrypt.hash(password, 10);
  const timestamp = Date.now();
  const userDocs = [];

  // Create users
  for (let i = 0; i < userCount; i += 1) {
    const fullName = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
    const city = pickRandom(cities);
    const role = pickRandom(roles);

    userDocs.push({
      fullName,
      email: `testuser${timestamp}${String(i + 1).padStart(3, "0")}@seed.insell.local`,
      password: hashedPassword,
      bio: `Real estate ${role.toLowerCase()} based in ${city}. Looking to connect with buyers and sellers.`,
      profilePic: "",
      city,
      activeRole: role,
      primaryRole: role,
      isOnboarded: true,
      friends: [],
    });
  }

  const insertedUsers = await User.insertMany(userDocs, { ordered: false });
  console.log(`Created ${insertedUsers.length} users`);

  // Create posts for each user
  const postDocs = [];
  for (const user of insertedUsers) {
    for (let i = 0; i < postsPerUser; i += 1) {
      const postType = pickRandom(postTypes);
      const propertyType = pickRandom(propertyTypes);
      const listingType = pickRandom(listingTypes);
      const city = pickRandom(cities);
      const locality = pickRandom(localities);
      const bedrooms = Math.floor(Math.random() * 4) + 1;
      const bathrooms = Math.floor(Math.random() * 3) + 1;
      const areaSqft = (Math.floor(Math.random() * 20) + 5) * 100;
      const price = areaSqft * (Math.floor(Math.random() * 15) + 5) * 1000;
      const mediaCount = Math.floor(Math.random() * 3) + 1;

      postDocs.push({
        author: user._id,
        authorRole: user.activeRole,
        postType,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        listingType,
        propertyType,
        title: pickRandom(propertyTitles),
        caption: pickRandom(captions),
        city,
        locality,
        price,
        bedrooms,
        bathrooms,
        areaSqft,
        mediaUrls: sampleMany(sampleImages, mediaCount),
        likedBy: [],
        savedBy: [],
        viewCount: Math.floor(Math.random() * 500),
        shareCount: Math.floor(Math.random() * 50),
        commentCount: Math.floor(Math.random() * 20),
        chatCount: Math.floor(Math.random() * 10),
        engagementScore: 0,
        postMeta: {},
      });
    }
  }

  const insertedPosts = await PropertyPost.insertMany(postDocs, { ordered: false });
  console.log(`Created ${insertedPosts.length} posts`);

  console.log("Seed completed successfully");
  console.log(`Created users: ${insertedUsers.length}`);
  console.log(`Created posts: ${insertedPosts.length}`);
  console.log(`Login password for all seeded users: ${password}`);
  console.log(`Email pattern example: ${insertedUsers[0]?.email || "n/a"}`);

  await mongoose.connection.close();
}

seedUsersAndPosts().catch(async (error) => {
  console.error("Failed to seed users and posts:", error?.message || error);
  try {
    await mongoose.connection.close();
  } catch {
    // Ignore close errors in failure path.
  }
  process.exit(1);
});
