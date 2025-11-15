import { Request, Response } from 'express';

export interface Config {
  apiKey: string;
  baseUrl: string;
  debug: boolean;
}

export interface RequestLog {
  method: string;
  url: string;
  path: string;
  query: Record<string, any>;
  headers: Record<string, any>;
  body?: any;
  ip?: string;
}

export interface ResponseLog {
  statusCode: number;
  headers: Record<string, any>;
  body?: any;
  contentType?: string;
}

export interface ErrorLog {
  message: string;
  stack?: string;
  statusCode?: number;
  body?: any;
}

export interface LogEvent {
  timestamp: string;
  duration: number;
  requestId?: string;
  request: RequestLog;
  response?: ResponseLog;
  error?: ErrorLog;
}

export interface LogsentinelConfig {
  apiKey?: string;
  baseUrl?: string;
  debug?: boolean;
}

export interface TransformedLogEvent {
  timestamp: string;
  trace_id: string;
  request: {
    method: string;
    path: string;
    headers: Record<string, any>;
    body: string | null;
    ip: string | null;
  };
  response: {
    status: number;
    headers: Record<string, any>;
    body: string | null;
    duration_ms: number;
  };
}

