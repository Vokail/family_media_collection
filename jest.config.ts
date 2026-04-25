import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testPathPattern: '__tests__',
}

export default config
