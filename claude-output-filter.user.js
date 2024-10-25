// ==UserScript==
// @name         Claude Output Filter
// @namespace    https://github.com/DamienMarill/claude_output_filter
// @version      1.1.0
// @description  Filter Claude's responses to show only output content
// @author       Marill
// @match        https://claude.ai/chat/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @grant        none
// @license      MIT
// @supportURL   https://github.com/DamienMarill/claude_output_filter/issues
// @homepageURL  https://github.com/DamienMarill/claude_output_filter
// @updateURL    https://raw.githubusercontent.com/DamienMarill/claude_output_filter/main/claude-output-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/DamienMarill/claude_output_filter/main/claude-output-filter.user.js
// ==/UserScript==

(function() {
    'use strict';

    let filterEnabled = true;
    let isInitialized = false;

    // Vérifie si on est sur une page de chat
    const isChatPage = () => {
        return window.location.pathname.startsWith('/chat/');
    };

    // Nettoie l'état précédent
    const cleanup = () => {
        // Supprime le bouton s'il existe
        const button = document.getElementById('toggleFilter');
        if (button) button.parentElement.remove();

        // Déconnecte l'observer s'il existe
        if (window.messageObserver) {
            window.messageObserver.disconnect();
            delete window.messageObserver;
        }

        isInitialized = false;
    };

        // Gère les changements de route
    const handleRouteChange = () => {
        console.log('Route changed:', window.location.pathname);

        // Nettoie toujours l'état précédent
        cleanup();

        // Initialise si on est sur une page de chat
        if (isChatPage()) {
            console.log('Chat page detected, initializing...');
            init();
        }
    };

    // Initialise l'observation des changements de route
    const setupRouteObserver = () => {
        // Observe les changements via l'API History
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            handleRouteChange();
        };

        // Gère le bouton retour/avant du navigateur
        window.addEventListener('popstate', handleRouteChange);

        // Vérifie la route initiale
        handleRouteChange();
    };

    const addFloatingButton = () => {
        const container = document.querySelector('.sticky.top-0.z-10 .hidden.flex-row-reverse');

        const button = document.createElement('button');
        button.id = 'toggleFilter';
        button.innerHTML = '🎭';
        button.classList = `
inline-flex
  items-center
  justify-center
  relative
  shrink-0
  ring-offset-2
  ring-offset-bg-300
  ring-accent-main-100
  focus-visible:outline-none
  focus-visible:ring-1
  disabled:pointer-events-none
  disabled:opacity-50
  disabled:shadow-none
  disabled:drop-shadow-none text-text-200
          border-transparent
          transition-colors
          font-styrene
          active:bg-bg-400
          hover:bg-bg-500/40
          hover:text-text-100 h-9 w-9 rounded-md active:scale-95 shrink-0 relative
        `;

        const updateButtonStyle = (enabled) => {
            if (enabled){
                button.classList.remove('bg-bg-400');
            }else{
                button.classList.add('bg-bg-400');
            }
        };

        button.addEventListener('click', () => {
            filterEnabled = !filterEnabled;
            updateButtonStyle(filterEnabled);
            toggleAllMessages();
        });

        // Applique le style initial
        updateButtonStyle(filterEnabled);
        container.appendChild(button);
    };

    const extractOutput = (content) => {
        const matches = content.match(/&lt;output&gt;([\s\S]*?)&lt;\/output&gt;/);
        return matches ? matches[1].trim() : content;
    };

    const createFilteredVersion = (messageEl) => {
        if (messageEl.nextElementSibling?.classList?.contains('filtered-message')) {
            return messageEl.nextElementSibling;
        }

        const content = messageEl.querySelector('.grid-cols-1.grid.gap-2\\.5');
        if (!content) return null;

        const filteredDiv = document.createElement('div');
        filteredDiv.classList.add('filtered-message', 'font-claude-message');

        // Ajoute les classes de formatage
        filteredDiv.classList.add(
            'pr-4',
            'md:pr-9',
            'relative',
            'leading-[1.65rem]',
            '[&_pre>div]:bg-bg-300',
            '[&_.ignore-pre-bg>div]:bg-transparent',
            '[&_pre]:-mr-4',
            'md:[&_pre]:-mr-9'
        );

        filteredDiv.style.cssText = messageEl.style.cssText;

        const filteredContent = extractOutput(content.innerHTML);
        filteredDiv.innerHTML = `<div class="grid-cols-1 grid gap-2.5">${filteredContent}</div>`;

        // État initial basé sur filterEnabled
        filteredDiv.style.display = filterEnabled ? 'block' : 'none';
        messageEl.style.display = filterEnabled ? 'none' : 'block';

        messageEl.parentNode.insertBefore(filteredDiv, messageEl.nextSibling);
        return filteredDiv;
    };

    const toggleMessage = (messageEl) => {
        const filteredVersion = createFilteredVersion(messageEl);
        if (!filteredVersion) return;

        messageEl.style.display = filterEnabled ? 'none' : 'block';
        filteredVersion.style.display = filterEnabled ? 'block' : 'none';
    };

    const toggleAllMessages = () => {
        const messages = document.querySelectorAll('.font-claude-message:not(.filtered-message)');
        messages.forEach(toggleMessage);
    };

const setupObserver = () => {
    console.log('Setting up observer...');

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            // Pour chaque nœud ajouté
            mutation.addedNodes.forEach(node => {
                // Vérifie si c'est un élément DOM
                if (node.nodeType !== 1) return;

                // Recherche l'élément de message le plus proche
                // soit dans le nœud lui-même, soit dans ses enfants
                let messageElement = node.getAttribute('data-is-streaming') !== null ?
                    node : node.querySelector('[data-is-streaming]');

                if (messageElement) {

                    // Vérifie si le message est déjà terminé
                    if (messageElement.getAttribute('data-is-streaming') === 'false') {
                        const claudeMessage = messageElement.querySelector('.font-claude-message:not(.filtered-message)');
                        if (claudeMessage) toggleMessage(claudeMessage);
                    } else {
                        // Observe spécifiquement ce message pour le changement de streaming
                        const streamObserver = new MutationObserver((streamMutations) => {
                            streamMutations.forEach(streamMutation => {
                                if (streamMutation.type === 'attributes' &&
                                    streamMutation.attributeName === 'data-is-streaming') {

                                    const isStreaming = streamMutation.target.getAttribute('data-is-streaming');

                                    if (isStreaming === 'false') {
                                        console.log('Message completed, applying filter');
                                        setTimeout(() => {
                                            const claudeMessage = messageElement.querySelector('.font-claude-message:not(.filtered-message)');
                                            if (claudeMessage) toggleMessage(claudeMessage);
                                            streamObserver.disconnect();
                                        }, 100);
                                    }
                                }
                            });
                        });

                        // Observe les changements d'attributs sur le message
                        streamObserver.observe(messageElement, {
                            attributes: true,
                            attributeFilter: ['data-is-streaming']
                        });
                    }
                }
            });
        });
    });

    // Observe le conteneur principal
    const container = document.body;
    if (container) {
        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-is-streaming']
        });
        console.log('Observer attached to main container');
    }
};

    const init = () => {
        if (isInitialized) return;

        setTimeout(() => {
            // Ajoute d'abord le bouton
            addFloatingButton();

            // Puis configure l'observer
            setupObserver();

            // Enfin, applique le filtre initial
            toggleAllMessages();

            isInitialized = true;
        }, 1500);
    };
        // Point d'entrée du script
    const start = () => {
        console.log('Starting script...');
        setupRouteObserver();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        start();
    }
})();