import { mount } from 'svelte';
import App from './App.svelte';

// セットアップガイドページのエントリ
mount(App, { target: document.getElementById('app')! });
