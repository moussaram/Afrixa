const getErrorText = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return '';

  const value = error as Record<string, unknown>;
  return [value.code, value.message, value.details, value.hint]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
};

export const getFriendlyTransactionError = (error: unknown): string => {
  const message = getErrorText(error).toLowerCase();
  if (message.includes('insufficient_funds') || message.includes('solde')) {
    return 'Ton solde Mobile Money est insuffisant. Recharge ton compte puis réessaie.';
  }
  if (message.includes('invalid_account') || message.includes('invalid phone') || message.includes('numero invalide')) {
    return 'Le numéro Mobile Money semble incorrect. Vérifie-le puis réessaie.';
  }
  if (message.includes('timeout') || message.includes('expired') || message.includes('expire')) {
    return 'Le délai de paiement a expiré. Tu peux relancer le paiement.';
  }
  if (message.includes('network') || message.includes('connexion')) {
    return 'La connexion a interrompu le paiement. Vérifie Internet puis réessaie.';
  }
  if (message.includes('duplicate_transaction') || message.includes('duplicate transaction')) {
    return 'Cette transaction existe déjà. Vérifie son statut avant de recommencer.';
  }
  if (message.includes('user_cancelled') || message.includes('canceled') || message.includes('cancelled')) {
    return 'Paiement annulé. Tu peux réessayer quand tu veux.';
  }
  if (message.includes('complete_payment_profile')) {
    return 'Complète ton nom, ton e-mail et ton numéro de paiement dans ton profil.';
  }
  if (message.includes('payment_creation_in_progress')) {
    return 'La demande de paiement est déjà en cours. Patiente un instant puis vérifie son statut.';
  }
  if (message.includes('connectez-vous') || message.includes('unauthorized')) {
    return 'Connecte-toi à ton compte avant de payer.';
  }
  if (message.includes('order_not_payable') || message.includes('payment_not_available')) {
    return 'Cette commande ne peut plus être payée. Vérifie son statut dans tes commandes.';
  }
  return 'Le paiement n’a pas pu être traité. Réessaie plus tard ou contacte le support Afrixa.';
};
