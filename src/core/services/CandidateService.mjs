/**
 * Candidate Service
 * Business logic for candidate operations
 */

import { candidateRepository } from "../repositories/CandidateRepository.mjs";
import { ValidationError, NotFoundError } from "../../shared/utils/response.mjs";
import { CACHE_CONFIG } from "../../shared/utils/constants.mjs";

// In-memory cache
let candidatesCache = null;
let cacheTimestamp = 0;

export class CandidateService {
  /**
   * Get all candidates with their vote counts
   * @param {boolean} useCache - Whether to use cache
   * @returns {Promise<Array>}
   */
  async getAllCandidates(useCache = true) {
    const now = Date.now();
    
    // Return cached data if valid
    if (useCache && candidatesCache && (now - cacheTimestamp) < CACHE_CONFIG.CANDIDATES_TTL) {
      console.log('Returning cached candidates');
      return candidatesCache;
    }
    
    console.log('Fetching fresh candidates from DynamoDB');
    
    // Fetch candidates and vote results in parallel
    const [candidates, voteResults] = await Promise.all([
      candidateRepository.getAllCandidates(),
      candidateRepository.getAllVoteResults()
    ]);
    
    // Create vote count map
    const votesMap = {};
    voteResults.forEach(item => {
      votesMap[item.CandidateId] = item.votes || 0;
    });
    
    // Merge candidates with vote counts
    const candidatesWithVotes = candidates.map(candidate => ({
      ...candidate,
      votes: votesMap[candidate.CandidateId] || 0
    }));
    
    // Update cache
    candidatesCache = candidatesWithVotes;
    cacheTimestamp = now;
    
    return candidatesWithVotes;
  }

  /**
   * Get a single candidate by ID
   * @param {string} candidateId 
   * @returns {Promise<Object>}
   */
  async getCandidateById(candidateId) {
    const [candidate, voteCount] = await Promise.all([
      candidateRepository.getCandidateById(candidateId),
      candidateRepository.getVoteCount(candidateId)
    ]);
    
    if (!candidate) {
      throw new NotFoundError('Candidate not found');
    }
    
    return {
      ...candidate,
      votes: voteCount
    };
  }

  /**
   * Create a new candidate
   * @param {Object} candidateData 
   * @returns {Promise<Object>}
   */
  async createCandidate(candidateData) {
    const { name, description, imageUrl } = candidateData;
    
    if (!name) {
      throw new ValidationError('Candidate name is required');
    }
    
    const candidate = {
      CandidateId: `cand${Date.now()}`,
      name,
      description: description || '',
      imageUrl: imageUrl || '',
      createdAt: new Date().toISOString()
    };
    
    await candidateRepository.createCandidate(candidate);
    
    // Invalidate cache
    this.invalidateCache();
    
    return candidate;
  }

  /**
   * Update an existing candidate
   * @param {string} candidateId 
   * @param {Object} updates 
   * @returns {Promise<Object>}
   */
  async updateCandidate(candidateId, updates) {
    // Validate candidate exists
    const existing = await candidateRepository.getCandidateById(candidateId);
    if (!existing) {
      throw new NotFoundError('Candidate not found');
    }
    
    // Remove immutable fields
    const { CandidateId, createdAt, ...validUpdates } = updates;
    
    if (Object.keys(validUpdates).length === 0) {
      throw new ValidationError('No valid fields to update');
    }
    
    validUpdates.updatedAt = new Date().toISOString();
    
    const updated = await candidateRepository.updateCandidate(candidateId, validUpdates);
    
    // Invalidate cache
    this.invalidateCache();
    
    return updated;
  }

  /**
   * Delete a candidate
   * @param {string} candidateId 
   */
  async deleteCandidate(candidateId) {
    // Validate candidate exists
    const existing = await candidateRepository.getCandidateById(candidateId);
    if (!existing) {
      throw new NotFoundError('Candidate not found');
    }
    
    await candidateRepository.deleteCandidate(candidateId);
    
    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Invalidate cache
   */
  invalidateCache() {
    candidatesCache = null;
    cacheTimestamp = 0;
  }
}

export const candidateService = new CandidateService();
