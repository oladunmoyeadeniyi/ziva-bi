/**
 * Backward-compat shim — re-exports Button from the canonical ui/button path.
 *
 * Some pages were written importing from "@/components/Button" (default import).
 * The real component lives at "@/components/ui/button" (named export).
 * This shim bridges the two without touching every calling file.
 */
export { Button as default, Button, buttonVariants } from "@/components/ui/button";
