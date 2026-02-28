/**
 * Design System Tokens
 * 
 * These tokens define the visual language of the application.
 * DO NOT modify these values mid-project to maintain consistency.
 */

export const designTokens = {
  /**
   * Spacing Scale (8px base)
   * Use these values for margins, padding, and gaps
   */
  spacing: {
    1: '4px',   // 0.25rem
    2: '8px',   // 0.5rem
    3: '12px',  // 0.75rem
    4: '16px',  // 1rem
    6: '24px',  // 1.5rem
    8: '32px',  // 2rem
  },

  /**
   * Border Radius
   */
  borderRadius: {
    standard: '8px',  // Standard components
    pill: '999px',    // Pills and chips
  },

  /**
   * Component Specifications
   */
  components: {
    button: {
      height: '36px',
      paddingX: '16px',
      paddingY: '12px',
    },
    card: {
      padding: '16px',
      borderWidth: '1px',
    },
  },

  /**
   * Typography Hierarchy
   */
  typography: {
    h1: {
      minSize: '20px',
      maxSize: '24px',
    },
    h2: {
      minSize: '16px',
      maxSize: '18px',
    },
    body: {
      minSize: '14px',
      maxSize: '16px',
    },
  },

  /**
   * Responsive Breakpoints
   */
  breakpoints: {
    mobile: '768px',
    desktop: '1024px',
  },
} as const;

export type DesignTokens = typeof designTokens;
