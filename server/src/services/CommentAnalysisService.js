import { logger } from "../utils/logger.js";

class CommentAnalysisService {
  constructor() {
    // Property-related keywords for extraction
    this.propertyKeywords = [
      '2bhk', '3bhk', '4bhk', '1bhk', '2rk', '1rk',
      'apartment', 'flat', 'villa', 'house', 'penthouse', 'studio',
      'duplex', 'triplex', 'bunglow', 'condo', 'townhouse',
      'location', 'area', 'sqft', 'square', 'feet', 'carpet',
      'price', 'cost', 'rate', 'budget', 'expensive', 'cheap', 'affordable',
      'amenities', 'parking', 'garden', 'pool', 'gym', 'lift', 'elevator',
      'security', 'maintenance', 'society', 'complex', 'tower',
      'furnished', 'unfurnished', 'semi-furnished',
      'possession', 'ready', 'under-construction', 'upcoming',
      'facing', 'east', 'west', 'north', 'south',
      'floor', 'ground', 'top', 'middle',
      'age', 'new', 'old', 'recent',
      'rent', 'lease', 'buy', 'purchase', 'sell', 'investment',
      'nearby', 'close', 'proximity', 'distance',
      'school', 'hospital', 'market', 'mall', 'metro', 'station',
      'loan', 'emi', 'finance', 'bank',
      'rera', 'registered', 'legal', 'approved'
    ];

    // Sentiment words
    this.positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'beautiful',
      'perfect', 'awesome', 'nice', 'best', 'love', 'like', 'happy',
      'satisfied', 'impressed', 'recommend', 'clean', 'spacious', 'modern',
      'well-maintained', 'prime', 'convenient', 'accessible', 'safe', 'secure'
    ];

    this.negativeWords = [
      'bad', 'poor', 'terrible', 'awful', 'worst', 'hate', 'dislike',
      'unhappy', 'dissatisfied', 'disappointed', 'dirty', 'small', 'cramped',
      'old', 'damaged', 'risky', 'unsafe', 'expensive', 'overpriced',
      'far', 'inconvenient', 'noisy', 'problem', 'issue', 'complaint'
    ];

    // Category patterns
    this.categoryPatterns = {
      inquiry: ['how', 'what', 'where', 'when', 'why', 'can you', 'is there', 'do you have'],
      feedback: ['think', 'feel', 'opinion', 'suggestion', 'improve', 'better'],
      compliment: ['good', 'great', 'excellent', 'nice', 'beautiful', 'amazing', 'love'],
      complaint: ['bad', 'poor', 'terrible', 'issue', 'problem', 'worst', 'disappointed'],
      question: ['?', 'how much', 'what is', 'can you tell', 'please explain']
    };

    // Intent patterns
    this.intentPatterns = {
      buying: ['buy', 'purchase', 'looking to buy', 'interested in buying', 'want to buy'],
      renting: ['rent', 'lease', 'looking for rent', 'want to rent', 'rental'],
      investing: ['investment', 'invest', 'roi', 'return', 'appreciation', 'future value'],
      comparing: ['compare', 'difference', 'better than', 'vs', 'versus', 'which one'],
      browsing: ['just looking', 'browsing', 'checking', 'exploring', 'information']
    };
  }

  /**
   * Extract keywords from comment text
   */
  extractKeywords(text) {
    const normalizedText = text.toLowerCase();
    const foundKeywords = new Set();

    this.propertyKeywords.forEach(keyword => {
      if (normalizedText.includes(keyword)) {
        foundKeywords.add(keyword);
      }
    });

    return Array.from(foundKeywords);
  }

  /**
   * Analyze sentiment of comment text
   */
  analyzeSentiment(text) {
    const normalizedText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    this.positiveWords.forEach(word => {
      if (normalizedText.includes(word)) positiveCount++;
    });

    this.negativeWords.forEach(word => {
      if (normalizedText.includes(word)) negativeCount++;
    });

    const total = positiveCount + negativeCount;
    let sentiment = 'neutral';
    let score = 0;

    if (total === 0) {
      sentiment = 'neutral';
      score = 0;
    } else if (positiveCount > negativeCount) {
      sentiment = 'positive';
      score = positiveCount / total;
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      score = -(negativeCount / total);
    } else {
      sentiment = 'neutral';
      score = 0;
    }

    return { sentiment, score };
  }

  /**
   * Categorize comment based on content
   */
  categorizeComment(text) {
    const normalizedText = text.toLowerCase();
    let maxMatches = 0;
    let category = 'other';

    Object.entries(this.categoryPatterns).forEach(([cat, patterns]) => {
      let matches = 0;
      patterns.forEach(pattern => {
        if (normalizedText.includes(pattern)) matches++;
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        category = cat;
      }
    });

    return category;
  }

  /**
   * Detect user intent from comment
   */
  detectIntent(text) {
    const normalizedText = text.toLowerCase();
    let maxMatches = 0;
    let intent = 'browsing';

    Object.entries(this.intentPatterns).forEach(([int, patterns]) => {
      let matches = 0;
      patterns.forEach(pattern => {
        if (normalizedText.includes(pattern)) matches++;
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        intent = int;
      }
    });

    return intent;
  }

  /**
   * Extract property mentions from comment
   */
  extractPropertyMentions(text) {
    const normalizedText = text.toLowerCase();
    const mentions = new Set();

    // Extract property types
    if (normalizedText.includes('2bhk') || normalizedText.includes('2 bhk')) mentions.add('2BHK');
    if (normalizedText.includes('3bhk') || normalizedText.includes('3 bhk')) mentions.add('3BHK');
    if (normalizedText.includes('4bhk') || normalizedText.includes('4 bhk')) mentions.add('4BHK');
    if (normalizedText.includes('1bhk') || normalizedText.includes('1 bhk')) mentions.add('1BHK');
    if (normalizedText.includes('apartment') || normalizedText.includes('flat')) mentions.add('apartment');
    if (normalizedText.includes('villa')) mentions.add('villa');
    if (normalizedText.includes('house')) mentions.add('house');
    if (normalizedText.includes('penthouse')) mentions.add('penthouse');
    if (normalizedText.includes('studio')) mentions.add('studio');

    // Extract price ranges
    if (normalizedText.includes('price') || normalizedText.includes('cost')) mentions.add('price');
    if (normalizedText.includes('budget')) mentions.add('budget');
    if (normalizedText.includes('affordable')) mentions.add('affordable');
    if (normalizedText.includes('expensive')) mentions.add('expensive');

    // Extract location-related
    if (normalizedText.includes('location') || normalizedText.includes('area')) mentions.add('location');
    if (normalizedText.includes('nearby') || normalizedText.includes('close')) mentions.add('nearby');

    // Extract amenities
    if (normalizedText.includes('parking')) mentions.add('parking');
    if (normalizedText.includes('garden')) mentions.add('garden');
    if (normalizedText.includes('pool') || normalizedText.includes('swimming')) mentions.add('pool');
    if (normalizedText.includes('gym')) mentions.add('gym');
    if (normalizedText.includes('security')) mentions.add('security');

    return Array.from(mentions);
  }

  /**
   * Analyze comment and return all analytics data
   */
  analyzeComment(text) {
    try {
      const keywords = this.extractKeywords(text);
      const { sentiment, score: sentimentScore } = this.analyzeSentiment(text);
      const category = this.categorizeComment(text);
      const propertyMentions = this.extractPropertyMentions(text);
      const intent = this.detectIntent(text);

      return {
        keywords,
        sentiment,
        sentimentScore,
        category,
        propertyMentions,
        intent
      };
    } catch (error) {
      logger.error('Error analyzing comment:', error);
      // Return default values on error
      return {
        keywords: [],
        sentiment: 'neutral',
        sentimentScore: 0,
        category: 'other',
        propertyMentions: [],
        intent: 'browsing'
      };
    }
  }

  /**
   * Update user comment analytics based on new comment
   */
  async updateUserCommentAnalytics(userId, commentAnalytics) {
    // This would typically update the User model
    // Implementation would be in the User service/controller
    logger.info(`Updating comment analytics for user ${userId}`, commentAnalytics);
  }
}

export default new CommentAnalysisService();
