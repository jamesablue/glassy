#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { addGlassyStack } from '../lib/glassy-app';

addGlassyStack(new App());
