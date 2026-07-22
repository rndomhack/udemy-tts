import { mount } from 'svelte';
import App from './App.svelte';

// オプションページのエントリ
mount(App, { target: document.getElementById('app')! });
