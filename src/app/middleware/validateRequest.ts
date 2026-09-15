import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject, ZodEffects } from "zod";

/**
 * Validates and REPLACES req.body/query/params with the parsed (and
 * type-coerced) Zod output. Every module's `<name>.validation.ts` exports
 * a schema shaped like { body: z.object({...}) } (or query/params), so
 * controllers can trust `req.body` is already the right shape.
 */
export const validateRequest =
  (schema: AnyZodObject | ZodEffects<AnyZodObject>) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (err) {
      next(err);
    }
  };
