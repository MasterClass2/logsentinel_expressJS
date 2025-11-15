import express, { Request, Response } from 'express';
import { logsentinelMiddleware, logsentinelErrorMiddleware } from '../middleware/logsentinelMiddleware';
import { logQueue } from '../core/sender';

// Mock the logQueue
jest.mock('../core/sender', () => ({
  logQueue: {
    push: jest.fn()
  }
}));

describe('Logsentinel Middleware', () => {
  let app: express.Application;
  let mockPush: jest.Mock;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mockPush = logQueue.push as jest.Mock;
    mockPush.mockClear();
  });

  describe('Request Capture', () => {
    it('should capture basic request data', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.json({ message: 'ok' });
      });

      const request = require('supertest')(app);
      
      request
        .get('/test?foo=bar')
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.request.method).toBe('GET');
          expect(logEvent.request.path).toBe('/test');
          expect(logEvent.request.query).toEqual({ foo: 'bar' });
          
          done();
        });
    });

    it('should capture request body', (done) => {
      app.use(logsentinelMiddleware());
      app.post('/test', (req, res) => {
        res.json({ message: 'ok' });
      });

      const request = require('supertest')(app);
      
      request
        .post('/test')
        .send({ username: 'john', password: 'secret' })
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.request.body.username).toBe('john');
          expect(logEvent.request.body.password).toBe('[REDACTED]');
          
          done();
        });
    });

    it('should capture request headers', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.json({ message: 'ok' });
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .set('X-Custom-Header', 'value')
        .set('Authorization', 'Bearer token123')
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.request.headers['x-custom-header']).toBe('value');
          expect(logEvent.request.headers['authorization']).toBe('[REDACTED]');
          
          done();
        });
    });
  });

  describe('Response Capture', () => {
    it('should capture response with res.json', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.json({ message: 'hello', token: 'secret123' });
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.response).toBeDefined();
          expect(logEvent.response.statusCode).toBe(200);
          expect(logEvent.response.body.message).toBe('hello');
          expect(logEvent.response.body.token).toBe('[REDACTED]');
          
          done();
        });
    });

    it('should capture response with res.send', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.send('Hello World');
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.response).toBeDefined();
          expect(logEvent.response.body).toBe('Hello World');
          
          done();
        });
    });

    it('should capture response status code', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.status(201).json({ created: true });
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .expect(201)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.response.statusCode).toBe(201);
          
          done();
        });
    });
  });

  describe('Metadata', () => {
    it('should include timestamp', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.json({ message: 'ok' });
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.timestamp).toBeDefined();
          expect(new Date(logEvent.timestamp).getTime()).toBeGreaterThan(0);
          
          done();
        });
    });

    it('should include request duration', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        setTimeout(() => {
          res.json({ message: 'ok' });
        }, 50);
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.duration).toBeGreaterThanOrEqual(50);
          
          done();
        });
    });

    it('should include unique request ID', (done) => {
      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.json({ message: 'ok' });
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .expect(200)
        .end(() => {
          expect(mockPush).toHaveBeenCalled();
          const logEvent = mockPush.mock.calls[0][0];
          
          expect(logEvent.requestId).toBeDefined();
          expect(logEvent.requestId).toMatch(/^req_/);
          
          done();
        });
    });
  });

  describe('Error Handling', () => {
    it('should never crash the app on logging errors', (done) => {
      // Mock push to throw an error
      mockPush.mockImplementation(() => {
        throw new Error('Queue error');
      });

      app.use(logsentinelMiddleware());
      app.get('/test', (req, res) => {
        res.json({ message: 'ok' });
      });

      const request = require('supertest')(app);
      
      request
        .get('/test')
        .expect(200)
        .end((err, res) => {
          expect(err).toBeFalsy();
          expect(res.body.message).toBe('ok');
          done();
        });
    });
  });
});
