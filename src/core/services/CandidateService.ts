/**
 * Candidate Service
 * Business logic for candidate operations
 */

import { candidateRepository } from "../repositories/CandidateRepository.js";
import { ValidationError, NotFoundError } from "../../shared/utils/response.js";
import { CACHE_CONFIG } from "../../shared/utils/constants.js";
import { Candidate } from "../models/types.js";

// In-memory cache
let candidatesCache: Candidate[] | null = null;
let cacheTimestamp = 0;

interface CandidateCreateData {
  name: string;
  description?: string;
  imageUrl?: string;
}

interface CandidateUpdateData {
  name?: string;
  description?: string;
  imageUrl?: string;
  CandidateId?: string;
  createdAt?: string;
}

export class CandidateService {
  /**
   * Get all candidates with their vote counts
   */
  async getAllCandidates(useCache = true): Promise<Candidate[]> {
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
    const votesMap: Record<string, number> = {};
    voteResults.forEach(item => {
      votesMap[item.CandidateId] = item.votes || 0;
    });
    
    // Merge candidates with vote counts
    const candidatesWithVotes: Candidate[] = candidates.map(candidate => ({
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
   */
  async getCandidateById(candidateId: string): Promise<Candidate> {
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
   */
  async createCandidate(candidateData: CandidateCreateData): Promise<Omit<Candidate, 'votes'>> {
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
   */
  async updateCandidate(
    candidateId: string, 
    updates: CandidateUpdateData
  ): Promise<Omit<Candidate, 'votes'>> {
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
    
    const updatesWithTimestamp = {
      ...validUpdates,
      updatedAt: new Date().toISOString()
    };
    
    const updated = await candidateRepository.updateCandidate(candidateId, updatesWithTimestamp);
    
    // Invalidate cache
    this.invalidateCache();
    
    return updated;
  }

  /**
   * Delete a candidate
   */
  async deleteCandidate(candidateId: string): Promise<void> {
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
  invalidateCache(): void {
    candidatesCache = null;
    cacheTimestamp = 0;
  }
}

export const candidateService = new CandidateService();
